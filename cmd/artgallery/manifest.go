package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

const (
	artworksDir  = "artworks"
	generatedDir = "generated"
	manifestName = "manifest.json"
)

// Artwork mirrors one entry of the manifest produced by
// tools/build-manifest.mjs, so ids, files and titles stay interchangeable
// between the web gallery and the local CLI.
type Artwork struct {
	ID    string `json:"id"`
	File  string `json:"file"`
	Title string `json:"title"`
}

// Manifest is the on-disk shape of <dir>/manifest.json.
type Manifest struct {
	Artworks []Artwork `json:"artworks"`
}

// imageExts matches EXTS in tools/build-manifest.mjs.
var imageExts = []string{".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"}

// svgBox is the square thumbnail size, same as generated/*.svg.
const svgBox = 128

func hasImageExt(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	for _, e := range imageExts {
		if ext == e {
			return true
		}
	}
	return false
}

// humanize turns a filename into a title the same way build-manifest does:
// "my_new_art.png" → "My New Art".
func humanize(name string) string {
	base := strings.TrimSuffix(name, filepath.Ext(name))
	words := strings.Fields(strings.NewReplacer("_", " ", "-", " ").Replace(base))
	for i, w := range words {
		r := []rune(w)
		r[0] = unicode.ToUpper(r[0])
		words[i] = string(r)
	}
	return strings.Join(words, " ")
}

// padID zero-pads an id to two digits ("1" → "01"), like padStart(2, '0').
func padID(n int) string { return fmt.Sprintf("%02d", n) }

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func loadManifest(path string) (Manifest, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return Manifest{Artworks: []Artwork{}}, nil
	}
	if err != nil {
		return Manifest{}, err
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return Manifest{}, fmt.Errorf("parse %s: %w", path, err)
	}
	if m.Artworks == nil {
		m.Artworks = []Artwork{}
	}
	return m, nil
}

func saveManifest(path string, m Manifest) error {
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

// syncArtworks rebuilds artworks/manifest.json and artworks/generated/*.svg
// from the files in artworks/, following tools/build-manifest.mjs: known
// files keep their id, new files continue after the highest id, ids are never
// renumbered, and SVGs of removed files are pruned. It never writes outside
// artworks/.
func syncArtworks(root string) (Manifest, error) {
	dir := filepath.Join(root, artworksDir)
	previous, err := loadManifest(filepath.Join(dir, manifestName))
	if err != nil {
		return Manifest{}, err
	}

	byFile := make(map[string]Artwork, len(previous.Artworks))
	next := 1
	for _, a := range previous.Artworks {
		byFile[a.File] = a
		if n, err := strconv.Atoi(a.ID); err == nil && n >= next {
			next = n + 1
		}
	}

	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return Manifest{Artworks: []Artwork{}}, nil
	}
	if err != nil {
		return Manifest{}, err
	}
	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue // subfolders are skipped, like the npm build
		}
		if hasImageExt(e.Name()) {
			files = append(files, e.Name())
		}
	}
	sort.Slice(files, func(i, j int) bool {
		return strings.ToLower(files[i]) < strings.ToLower(files[j])
	})

	manifest := Manifest{Artworks: make([]Artwork, 0, len(files))}
	for _, file := range files {
		art := Artwork{ID: padID(next), File: file, Title: humanize(file)}
		if seen, ok := byFile[file]; ok {
			art.ID = seen.ID
			if seen.Title != "" {
				art.Title = seen.Title
			}
		} else {
			next++
		}
		manifest.Artworks = append(manifest.Artworks, art)
	}

	genDir := filepath.Join(dir, generatedDir)
	if err := os.MkdirAll(genDir, 0o755); err != nil {
		return Manifest{}, err
	}
	valid := make(map[string]bool, len(manifest.Artworks))
	for _, a := range manifest.Artworks {
		valid[a.ID] = true
	}
	svgs, err := os.ReadDir(genDir)
	if err != nil {
		return Manifest{}, err
	}
	for _, e := range svgs {
		id := strings.TrimSuffix(e.Name(), ".svg")
		if id == e.Name() || !isDigits(id) || valid[id] {
			continue
		}
		if err := os.Remove(filepath.Join(genDir, e.Name())); err != nil {
			return Manifest{}, err
		}
	}
	for _, a := range manifest.Artworks {
		src := filepath.Join(dir, a.File)
		dst := filepath.Join(genDir, a.ID+".svg")
		if err := writeSquareSVG(src, dst); err != nil {
			return Manifest{}, err
		}
	}

	if err := saveManifest(filepath.Join(dir, manifestName), manifest); err != nil {
		return Manifest{}, err
	}
	return manifest, nil
}

// writeSquareSVG embeds the original artwork in a square SVG, exactly like
// tools/build-manifest.mjs: 128×128, base64 data URI, cropped to fill. The
// source image is only read, never modified.
func writeSquareSVG(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	svg := `<svg xmlns="http://www.w3.org/2000/svg" width="` + fmt.Sprint(svgBox) +
		`" height="` + fmt.Sprint(svgBox) + `" viewBox="0 0 ` + fmt.Sprint(svgBox) + ` ` + fmt.Sprint(svgBox) +
		`"><image width="` + fmt.Sprint(svgBox) + `" height="` + fmt.Sprint(svgBox) +
		`" href="data:` + mimeFor(src) + `;base64,` + base64.StdEncoding.EncodeToString(data) +
		`" preserveAspectRatio="xMidYMid slice"/></svg>` + "\n"
	return os.WriteFile(dst, []byte(svg), 0o644)
}

// mimeFor matches the mime mapping in tools/build-manifest.mjs.
func mimeFor(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".jpg" || ext == ".jpeg" {
		return "image/jpeg"
	}
	return "image/" + strings.TrimPrefix(ext, ".")
}

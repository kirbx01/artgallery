package main

import (
	"bytes"
	"encoding/base64"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestHumanize(t *testing.T) {
	cases := map[string]string{
		"my_new_art.png":       "My New Art",
		"angrypup.png":         "Angrypup",
		"CID_funartposter.png": "CID Funartposter",
		"line-art_v2.gif":      "Line Art V2",
		"mixedUP image.jpeg":   "MixedUP Image",
	}
	for in, want := range cases {
		if got := humanize(in); got != want {
			t.Errorf("humanize(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPadID(t *testing.T) {
	cases := map[int]string{1: "01", 9: "09", 10: "10", 100: "100"}
	for n, want := range cases {
		if got := padID(n); got != want {
			t.Errorf("padID(%d) = %q, want %q", n, got, want)
		}
	}
}

// TestSyncArtworksKeepsIDs pins the id conventions of tools/build-manifest.mjs:
// sorted listing, ids attached to filenames, never renumbered, new files
// continue after the highest id, stale SVGs pruned.
func TestSyncArtworksKeepsIDs(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, artworksDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	write := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("b.png", "bbb")
	write("a.png", "aaa")

	m, err := syncArtworks(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Artworks) != 2 {
		t.Fatalf("got %d artworks, want 2", len(m.Artworks))
	}
	if m.Artworks[0].ID != "01" || m.Artworks[0].File != "a.png" {
		t.Errorf("sorted first = %+v, want id 01 file a.png", m.Artworks[0])
	}
	if m.Artworks[1].ID != "02" || m.Artworks[1].File != "b.png" {
		t.Errorf("sorted second = %+v, want id 02 file b.png", m.Artworks[1])
	}

	write("c.png", "ccc")
	if err := os.Remove(filepath.Join(dir, "a.png")); err != nil {
		t.Fatal(err)
	}
	m2, err := syncArtworks(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(m2.Artworks) != 2 {
		t.Fatalf("got %d artworks after delete, want 2", len(m2.Artworks))
	}
	if m2.Artworks[0].ID != "02" || m2.Artworks[0].File != "b.png" {
		t.Errorf("kept id = %+v, want id 02 file b.png", m2.Artworks[0])
	}
	if m2.Artworks[1].ID != "03" || m2.Artworks[1].File != "c.png" {
		t.Errorf("new id = %+v, want id 03 file c.png", m2.Artworks[1])
	}

	if _, err := os.Stat(filepath.Join(dir, generatedDir, "01.svg")); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("stale 01.svg should be pruned, stat err = %v", err)
	}
	for _, id := range []string{"02.svg", "03.svg"} {
		if _, err := os.Stat(filepath.Join(dir, generatedDir, id)); err != nil {
			t.Errorf("missing %s: %v", id, err)
		}
	}

	data, err := os.ReadFile(filepath.Join(dir, manifestName))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(data), "{\n  \"artworks\": [") || !strings.HasSuffix(string(data), "}\n") {
		t.Errorf("manifest shape differs from build-manifest output:\n%s", data)
	}
}

func TestWriteSquareSVG(t *testing.T) {
	root := t.TempDir()
	payload := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3}
	cases := map[string]string{
		".png": "data:image/png;base64,",
		".jpg": "data:image/jpeg;base64,",
	}
	for ext, mime := range cases {
		src := filepath.Join(root, "art"+ext)
		if err := os.WriteFile(src, payload, 0o644); err != nil {
			t.Fatal(err)
		}
		dst := filepath.Join(root, "art"+ext+".svg")
		if err := writeSquareSVG(src, dst); err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(dst)
		if err != nil {
			t.Fatal(err)
		}
		s := string(data)
		for _, want := range []string{
			`width="128"`, `height="128"`, `viewBox="0 0 128 128"`,
			mime, `preserveAspectRatio="xMidYMid slice"`,
		} {
			if !strings.Contains(s, want) {
				t.Errorf("%s: svg missing %s\n%s", ext, want, s)
			}
		}
		i := strings.Index(s, "base64,")
		if i < 0 {
			t.Fatalf("%s: no base64 payload", ext)
		}
		enc := s[i+len("base64,"):]
		enc = enc[:strings.Index(enc, `"`)]
		got, err := base64.StdEncoding.DecodeString(enc)
		if err != nil {
			t.Fatalf("%s: embedded payload is not valid base64: %v", ext, err)
		}
		if !bytes.Equal(got, payload) {
			t.Errorf("%s: embedded payload differs from the original", ext)
		}
	}
}

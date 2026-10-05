package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const (
	defaultAddr = "localhost:8080"
	defaultBase = "http://" + defaultAddr
)

func exportCmd(args []string, root string, stdout io.Writer) error {
	fs := flag.NewFlagSet("export", flag.ContinueOnError)
	readme := fs.Bool("readme", false, "print a centered GitHub README HTML snippet to stdout")
	width := fs.Int("width", 0, "thumbnail width in pixels (default: profileIcons.size from gallery.config.json, else 52)")
	base := fs.String("base", "", "base URL for links and thumbnails (default: siteUrl for the built-in gallery, "+defaultBase+" for local artworks)")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}
	if !*readme {
		return errors.New("export: missing required flag --readme")
	}
	return exportReadme(root, stdout, *width, *base)
}

type galleryConfig struct {
	SiteURL      string `json:"siteUrl"`
	ProfileIcons struct {
		Size int `json:"size"`
	} `json:"profileIcons"`
}

func loadConfig(root string) galleryConfig {
	data, err := os.ReadFile(filepath.Join(root, "gallery.config.json"))
	if err != nil {
		return galleryConfig{}
	}
	var c galleryConfig
	if err := json.Unmarshal(data, &c); err != nil {
		return galleryConfig{}
	}
	return c
}

// exportReadme prints the same centered snippet shape as the profile icons
// block in README.md: one <a><img></a> per artwork inside <p align="center">.
// Local artworks in artworks/ win; with none, the built-in gallery manifest
// is used. Everything goes to stdout so the snippet can be piped.
func exportReadme(root string, stdout io.Writer, width int, base string) error {
	manifest, err := loadManifest(filepath.Join(root, artworksDir, manifestName))
	if err != nil {
		return err
	}
	prefix := artworksDir + "/" + generatedDir
	local := len(manifest.Artworks) > 0
	if !local {
		manifest, err = loadManifest(filepath.Join(root, "artworksbyme", manifestName))
		if err != nil {
			return err
		}
		prefix = generatedDir
	}
	if len(manifest.Artworks) == 0 {
		return errors.New("no artworks found; run artgallery add <image> first")
	}

	if width == 0 {
		width = loadConfig(root).ProfileIcons.Size
	}
	if width <= 0 {
		width = 52 // same fallback as tools/build-manifest.mjs
	}

	if base == "" {
		base = defaultBase
		if !local {
			if site := strings.TrimRight(loadConfig(root).SiteURL, "/"); site != "" {
				base = site
			}
		}
	}
	base = strings.TrimRight(base, "/")

	var b strings.Builder
	b.WriteString("<p align=\"center\">\n")
	for _, a := range manifest.Artworks {
		fmt.Fprintf(&b, "  <a href=\"%s\"><img src=\"%s\" width=\"%d\" alt=\"%s\"></a>\n",
			htmlEscape(fmt.Sprintf("%s/?art=%s", base, a.ID)),
			htmlEscape(fmt.Sprintf("%s/%s/%s.svg", base, prefix, a.ID)),
			width, htmlEscape(a.Title))
	}
	b.WriteString("</p>")
	_, err = io.WriteString(stdout, b.String()+"\n")
	return err
}

// htmlEscape matches the escapeHtml helper in tools/build-manifest.mjs.
func htmlEscape(s string) string {
	return strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		"\"", "&quot;",
		"'", "&#39;",
	).Replace(s)
}

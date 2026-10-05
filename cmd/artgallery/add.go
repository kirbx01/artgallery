package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func addCmd(args []string, root string, stdout io.Writer) error {
	fs := flag.NewFlagSet("add", flag.ContinueOnError)
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}
	if fs.NArg() != 1 {
		return errors.New("usage: artgallery add <image>")
	}
	return addImage(root, fs.Arg(0), stdout)
}

// addImage imports src into <root>/artworks/: a byte-exact copy of the
// original, a stable id in artworks/manifest.json and a square SVG in
// artworks/generated/. The source file is never modified or moved, and
// nothing outside artworks/ is written.
func addImage(root, src string, stdout io.Writer) error {
	if !hasImageExt(src) {
		return fmt.Errorf("unsupported image type %q (supported: %s)",
			filepath.Ext(src), strings.Join(imageExts, ", "))
	}
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("%s is a directory", src)
	}
	dir := filepath.Join(root, artworksDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	dest := filepath.Join(dir, filepath.Base(src))
	copied, err := importImage(src, dest)
	if err != nil {
		return err
	}
	manifest, err := syncArtworks(root)
	if err != nil {
		return err
	}
	name := filepath.Base(dest)
	for _, a := range manifest.Artworks {
		if a.File != name {
			continue
		}
		state := "imported"
		if !copied {
			state = "already in artworks/"
		}
		fmt.Fprintf(stdout, "artgallery: %s %s as %s (%s)\n", state, name, a.ID, a.Title)
		fmt.Fprintf(stdout, "  original: %s\n  square:   %s\n",
			dest, filepath.Join(artworksDir, generatedDir, a.ID+".svg"))
		return nil
	}
	return fmt.Errorf("%s missing from manifest after sync", name)
}

// importImage copies src to dest without touching src. Re-importing the same
// bytes is a no-op; different bytes under the same name are refused, so an
// existing artwork is never overwritten.
func importImage(src, dest string) (bool, error) {
	srcData, err := os.ReadFile(src)
	if err != nil {
		return false, err
	}
	destData, err := os.ReadFile(dest)
	switch {
	case err == nil:
		if bytes.Equal(srcData, destData) {
			return false, nil
		}
		return false, fmt.Errorf("%s already exists with different contents; rename the source first", dest)
	case !errors.Is(err, fs.ErrNotExist):
		return false, err
	}
	return true, os.WriteFile(dest, srcData, 0o644)
}

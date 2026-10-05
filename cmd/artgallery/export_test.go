package main

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func addLocal(t *testing.T, root, name string) {
	t.Helper()
	src := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(src, []byte("bytes-"+name), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := addImage(root, src, io.Discard); err != nil {
		t.Fatal(err)
	}
}

func TestExportReadmeLocal(t *testing.T) {
	root := t.TempDir()
	addLocal(t, root, "first_art.png")
	addLocal(t, root, "second.png")

	var out bytes.Buffer
	if err := exportCmd([]string{"--readme", "--width", "64"}, root, &out); err != nil {
		t.Fatal(err)
	}
	s := out.String()
	if !strings.HasPrefix(s, "<p align=\"center\">\n") {
		t.Errorf("snippet is not centered: %q", s)
	}
	if !strings.HasSuffix(s, "</p>\n") {
		t.Errorf("snippet missing closing tag: %q", s)
	}
	if n := strings.Count(s, "<a href="); n != 2 {
		t.Errorf("got %d artwork links, want 2\n%s", n, s)
	}
	for _, want := range []string{
		`href="http://localhost:8080/?art=01"`,
		`href="http://localhost:8080/?art=02"`,
		`src="http://localhost:8080/artworks/generated/01.svg"`,
		`width="64"`,
		`alt="First Art"`,
		`alt="Second"`,
	} {
		if !strings.Contains(s, want) {
			t.Errorf("snippet missing %s\n%s", want, s)
		}
	}
	if strings.Contains(s, "```") {
		t.Errorf("stdout must be the raw HTML snippet, not fenced:\n%s", s)
	}
	// The referenced thumbnails are square SVGs on disk.
	for _, id := range []string{"01", "02"} {
		data, err := os.ReadFile(filepath.Join(root, artworksDir, generatedDir, id+".svg"))
		if err != nil {
			t.Fatalf("thumbnail %s.svg missing: %v", id, err)
		}
		if !strings.Contains(string(data), `viewBox="0 0 128 128"`) {
			t.Errorf("thumbnail %s.svg is not square: %s", id, data)
		}
	}
}

func TestExportReadmeWidthDefaultFromConfig(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "gallery.config.json"),
		[]byte(`{"profileIcons":{"size":99}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	addLocal(t, root, "art.png")

	var out bytes.Buffer
	if err := exportCmd([]string{"--readme"}, root, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), `width="99"`) {
		t.Errorf("width should come from gallery.config.json: %s", out.String())
	}
}

func TestExportReadmeBuiltInGalleryFallback(t *testing.T) {
	root := t.TempDir()
	webDir := filepath.Join(root, "artworksbyme")
	if err := os.MkdirAll(webDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(webDir, manifestName),
		[]byte(`{"artworks":[{"id":"01","file":"angrypup.png","title":"Angry Pup"}]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "gallery.config.json"),
		[]byte(`{"siteUrl":"https://example.test/g/"}`), 0o644); err != nil {
		t.Fatal(err)
	}

	var out bytes.Buffer
	if err := exportCmd([]string{"--readme"}, root, &out); err != nil {
		t.Fatal(err)
	}
	s := out.String()
	for _, want := range []string{
		`href="https://example.test/g/?art=01"`,
		`src="https://example.test/g/generated/01.svg"`,
		`width="52"`, // fallback when profileIcons.size is absent
	} {
		if !strings.Contains(s, want) {
			t.Errorf("snippet missing %s\n%s", want, s)
		}
	}
}

func TestExportReadmeCustomBase(t *testing.T) {
	root := t.TempDir()
	addLocal(t, root, "art.png")

	var out bytes.Buffer
	if err := exportCmd([]string{"--readme", "-base", "https://me.example/gallery/"}, root, &out); err != nil {
		t.Fatal(err)
	}
	s := out.String()
	if !strings.Contains(s, `href="https://me.example/gallery/?art=01"`) {
		t.Errorf("base not applied to link: %s", s)
	}
	if !strings.Contains(s, `src="https://me.example/gallery/artworks/generated/01.svg"`) {
		t.Errorf("base not applied to thumbnail: %s", s)
	}
}

func TestExportRequiresReadmeFlag(t *testing.T) {
	err := exportCmd(nil, t.TempDir(), io.Discard)
	if err == nil || !strings.Contains(err.Error(), "--readme") {
		t.Fatalf("expected a --readme error, got %v", err)
	}
}

func TestExportNoArtworks(t *testing.T) {
	if err := exportCmd([]string{"--readme"}, t.TempDir(), io.Discard); err == nil {
		t.Fatal("expected an error when there are no artworks")
	}
}

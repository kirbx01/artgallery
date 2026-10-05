package main

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAddImage(t *testing.T) {
	root := t.TempDir()
	src := filepath.Join(t.TempDir(), "my_new_art.png")
	original := []byte{0x89, 'P', 'N', 'G', 1, 2, 3, 4}
	if err := os.WriteFile(src, original, 0o644); err != nil {
		t.Fatal(err)
	}

	var out bytes.Buffer
	if err := addImage(root, src, &out); err != nil {
		t.Fatal(err)
	}

	// The original artwork is preserved, untouched, outside artworks/.
	if got, err := os.ReadFile(src); err != nil || !bytes.Equal(got, original) {
		t.Errorf("source changed: %q err=%v", got, err)
	}
	// The imported copy is byte-exact.
	cp, err := os.ReadFile(filepath.Join(root, artworksDir, "my_new_art.png"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(cp, original) {
		t.Error("imported copy differs from the original")
	}

	m, err := loadManifest(filepath.Join(root, artworksDir, manifestName))
	if err != nil {
		t.Fatal(err)
	}
	want := Artwork{ID: "01", File: "my_new_art.png", Title: "My New Art"}
	if len(m.Artworks) != 1 || m.Artworks[0] != want {
		t.Fatalf("manifest = %+v, want [%+v]", m.Artworks, want)
	}
	if _, err := os.Stat(filepath.Join(root, artworksDir, generatedDir, "01.svg")); err != nil {
		t.Fatalf("square svg missing: %v", err)
	}
	if !strings.Contains(out.String(), "01") {
		t.Errorf("stdout should mention the art id: %q", out.String())
	}

	// Re-importing the same bytes is idempotent.
	var out2 bytes.Buffer
	if err := addImage(root, src, &out2); err != nil {
		t.Fatal(err)
	}
	m2, err := loadManifest(filepath.Join(root, artworksDir, manifestName))
	if err != nil {
		t.Fatal(err)
	}
	if len(m2.Artworks) != 1 || m2.Artworks[0].ID != "01" {
		t.Errorf("re-import changed the manifest: %+v", m2.Artworks)
	}

	// Different bytes under the same name are refused, never overwritten.
	conflict := filepath.Join(t.TempDir(), "my_new_art.png")
	if err := os.WriteFile(conflict, []byte("different"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := addImage(root, conflict, io.Discard); err == nil {
		t.Fatal("expected a conflict error for different contents")
	}
	if got, _ := os.ReadFile(filepath.Join(root, artworksDir, "my_new_art.png")); !bytes.Equal(got, original) {
		t.Error("existing artwork was overwritten")
	}
}

func TestAddRejectsNonImage(t *testing.T) {
	root := t.TempDir()
	src := filepath.Join(t.TempDir(), "notes.txt")
	if err := os.WriteFile(src, []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := addImage(root, src, io.Discard); err == nil {
		t.Fatal("expected an error for unsupported extension")
	}

	dir := filepath.Join(t.TempDir(), "gallery.png")
	if err := os.Mkdir(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := addImage(root, dir, io.Discard); err == nil {
		t.Fatal("expected an error for a directory")
	}
}

// TestAddKeepsExistingGalleryUntouched pins requirement: add must not modify
// the artworksbyme/ gallery or the shared generated/ directory.
func TestAddKeepsExistingGalleryUntouched(t *testing.T) {
	root := t.TempDir()
	webDir := filepath.Join(root, "artworksbyme")
	if err := os.MkdirAll(webDir, 0o755); err != nil {
		t.Fatal(err)
	}
	webManifest := []byte("{\n  \"artworks\": [\n    {\n      \"id\": \"01\",\n      \"file\": \"angrypup.png\",\n      \"title\": \"Angry Pup\"\n    }\n  ]\n}\n")
	if err := os.WriteFile(filepath.Join(webDir, manifestName), webManifest, 0o644); err != nil {
		t.Fatal(err)
	}
	genDir := filepath.Join(root, generatedDir)
	if err := os.MkdirAll(genDir, 0o755); err != nil {
		t.Fatal(err)
	}
	sentinel := []byte("<svg>existing</svg>\n")
	if err := os.WriteFile(filepath.Join(genDir, "01.svg"), sentinel, 0o644); err != nil {
		t.Fatal(err)
	}

	src := filepath.Join(t.TempDir(), "photo.png")
	if err := os.WriteFile(src, []byte("photo"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := addImage(root, src, io.Discard); err != nil {
		t.Fatal(err)
	}

	if got, err := os.ReadFile(filepath.Join(webDir, manifestName)); err != nil || !bytes.Equal(got, webManifest) {
		t.Errorf("artworksbyme/manifest.json changed: %q err=%v", got, err)
	}
	if got, err := os.ReadFile(filepath.Join(genDir, "01.svg")); err != nil || !bytes.Equal(got, sentinel) {
		t.Errorf("generated/01.svg changed: %q err=%v", got, err)
	}
	m, err := loadManifest(filepath.Join(root, artworksDir, manifestName))
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Artworks) != 1 || m.Artworks[0].ID != "01" {
		t.Errorf("local manifest = %+v, want one artwork with id 01", m.Artworks)
	}
}

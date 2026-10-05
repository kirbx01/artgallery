package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestServeHandler(t *testing.T) {
	root := t.TempDir()
	write := func(rel, content string) {
		t.Helper()
		p := filepath.Join(root, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("index.html", "<!doctype html><title>gallery</title>")
	write("js/data.js", "window.ARTWORKS = [];")
	write("artworksbyme/manifest.json", `{"artworks":[]}`)
	write("artworks/generated/01.svg", "<svg/>")
	write(".git/config", "secret")
	write("server.js", "// node server")
	write("package.json", "{}")

	srv := httptest.NewServer(newHandler(root))
	defer srv.Close()

	for _, tc := range []struct {
		path string
		code int
	}{
		{"/", 200},
		{"/js/data.js", 200},
		{"/artworksbyme/manifest.json", 200},
		{"/artworks/generated/01.svg", 200},
		{"/.git/config", 404},
		{"/server.js", 404},
		{"/package.json", 404},
		{"/missing", 404},
	} {
		res, err := http.Get(srv.URL + tc.path)
		if err != nil {
			t.Fatal(err)
		}
		io.Copy(io.Discard, res.Body)
		res.Body.Close()
		if res.StatusCode != tc.code {
			t.Errorf("GET %s = %d, want %d", tc.path, res.StatusCode, tc.code)
		}
	}

	res, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if !strings.Contains(string(body), "<title>gallery</title>") {
		t.Errorf("index.html not served: %s", body)
	}
}

func TestDisplayAddr(t *testing.T) {
	if got := displayAddr(":9000"); got != "localhost:9000" {
		t.Errorf("displayAddr(:9000) = %q", got)
	}
	if got := displayAddr(defaultAddr); got != defaultAddr {
		t.Errorf("displayAddr(%q) = %q", defaultAddr, got)
	}
}

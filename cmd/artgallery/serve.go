package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strings"
)

func serveCmd(args []string, stdout io.Writer) error {
	fs := flag.NewFlagSet("serve", flag.ContinueOnError)
	addr := fs.String("addr", defaultAddr, "address to listen on")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}
	root, err := os.Getwd()
	if err != nil {
		return err
	}
	fmt.Fprintf(stdout, "artgallery: serving %s on http://%s\n", root, displayAddr(*addr))
	return http.ListenAndServe(*addr, newHandler(root))
}

func displayAddr(addr string) string {
	if strings.HasPrefix(addr, ":") {
		return "localhost" + addr
	}
	return addr
}

// newHandler serves the existing web app as plain static files from root.
// It exposes nothing but what is on disk: no database, no cloud storage,
// no authentication, no analytics.
func newHandler(root string) http.Handler {
	files := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !servedPath(r.URL.Path) {
			http.NotFound(w, r)
			return
		}
		files.ServeHTTP(w, r)
	})
}

// servedPath hides dotfiles (.git, .env, .DS_Store, …) plus the files
// server.js also refuses to send.
func servedPath(urlPath string) bool {
	for _, seg := range strings.Split(urlPath, "/") {
		if strings.HasPrefix(seg, ".") {
			return false
		}
	}
	switch path.Base(path.Clean(urlPath)) {
	case "server.js", "package.json", "package-lock.json":
		return false
	}
	return true
}

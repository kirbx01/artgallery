// Command artgallery is a small local-first CLI for the art gallery.
//
// It serves the existing web app from the current directory, imports images
// into a local artworks/ directory and prints GitHub README snippets.
// All artwork stays on this machine: no database, no cloud storage,
// no authentication and no analytics.
package main

import (
	"errors"
	"fmt"
	"io"
	"os"
)

const usage = `artgallery — local-first CLI for the art gallery.

Usage:
  artgallery serve [-addr host:port]
      Serve the existing web app locally (default localhost:8080).
      Plain static files, no database and no cloud storage.

  artgallery add <image>
      Copy an image into artworks/ (the original is preserved), assign a
      stable art id and build the square <id>.svg thumbnail.

  artgallery export --readme [-width px] [-base URL]
      Print a centered GitHub README snippet to stdout: every artwork links
      to its ?art=NN page with a square thumbnail.

Artwork never leaves this machine.`

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, "artgallery:", err)
		os.Exit(1)
	}
}

func run(args []string, stdout, stderr io.Writer) error {
	if len(args) == 0 {
		fmt.Fprintln(stderr, usage)
		return errors.New("missing command")
	}
	switch args[0] {
	case "serve":
		return serveCmd(args[1:], stdout)
	case "add":
		return addCmd(args[1:], ".", stdout)
	case "export":
		return exportCmd(args[1:], ".", stdout)
	case "help", "-h", "--help":
		fmt.Fprintln(stdout, usage)
		return nil
	default:
		fmt.Fprintln(stderr, usage)
		return fmt.Errorf("unknown command %q", args[0])
	}
}

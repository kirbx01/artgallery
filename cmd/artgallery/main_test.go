package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestRunHelp(t *testing.T) {
	var out, errOut bytes.Buffer
	if err := run([]string{"help"}, &out, &errOut); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"artgallery serve", "artgallery add", "artgallery export --readme"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("usage missing %q:\n%s", want, out.String())
		}
	}
}

func TestRunUnknownCommand(t *testing.T) {
	var out, errOut bytes.Buffer
	if err := run([]string{"frobnicate"}, &out, &errOut); err == nil {
		t.Fatal("expected an error for an unknown command")
	}
	if !strings.Contains(errOut.String(), "Usage:") {
		t.Errorf("usage not printed to stderr: %q", errOut.String())
	}
}

func TestRunMissingCommand(t *testing.T) {
	var out, errOut bytes.Buffer
	if err := run(nil, &out, &errOut); err == nil {
		t.Fatal("expected an error when no command is given")
	}
}

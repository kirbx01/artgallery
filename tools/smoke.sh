#!/usr/bin/env bash
# Smoke test: start the static server, hit key URLs, stop it.
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-3199}"
export PORT
node server.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT
sleep 1

fail=0
check() {
  local name="$1" path="$2" want="$3"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT$path")
  if [ "$code" = "$want" ]; then
    echo "ok   $name ($code)"
  else
    echo "FAIL $name (got $code, want $want)"
    fail=1
  fi
}

check "index"       "/"                      200
check "css"         "/css/style.css"         200
check "app.js"      "/js/app.js"             200
check "editor.js"   "/js/editor.js"          200
check "readme.js"   "/js/readme.js"          200
check "favicon"     "/paintbrush.png"        200
check "manifest"    "/artworksbyme/manifest.json" 200
check "server.js hidden" "/server.js"        404
check "pkg hidden"  "/package.json"          404
check ".git hidden" "/.git/config"           404

exit $fail


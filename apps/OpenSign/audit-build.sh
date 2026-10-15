#!/bin/sh
# Checks the built front end (./build): no outside hosts the page could call, no upstream branding.
set -eu
BAD='opensignlabs|cdn\.jsdelivr|unpkg\.com|lottie\.host|digitaloceanspaces|fonts\.googleapis|fonts\.gstatic|ipapi\.co|ui-avatars|placehold\.co|staticimgly|accounts\.google\.com|sheetjs\.com'
if grep -rIEl "$BAD" build >/dev/null 2>&1; then
  echo "audit-build: outside host found in the built front end:" >&2
  grep -rIEo ".{0,30}($BAD).{0,30}" build | head -20 >&2
  exit 1
fi
# "OpenSign" may appear only in the attribution line (AGPL-3.0 notice)
LEFT=$(grep -rIio '.\{0,40\}opensign.\{0,40\}' build | grep -vi 'based on OpenSign, licensed AGPL-3.0' || true)
if [ -n "$LEFT" ]; then
  echo "audit-build: upstream name found outside the attribution line:" >&2
  echo "$LEFT" | head -20 >&2
  exit 1
fi
echo "audit-build: clean"

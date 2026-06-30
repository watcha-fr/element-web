#! /usr/bin/env bash

# usage: run from res/watcha_icons/
#   ie: ../../scripts/watcha_make-opengraph-icon.sh

set -e
set -x

if [ -n "$1" ]; then
    source=$1
else
    source="../themes/watcha/img/logos/watcha_logo-text.svg"
fi

convert \
    -density 1000 \
    -fuzz 1% \
    -trim \
    +repage \
    -resize "x240" \
    -gravity center \
    -extent "1200x630" \
    "$source" opengraph.png

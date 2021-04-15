#! /usr/bin/env bash

# usage: run from res/watcha_icons/
#   ie: ../../scripts/watcha_make-icons.sh

set -e
set -x

if [ -n "$1" ]; then
    source=$1
else
    source="../themes/watcha/img/logos/watcha_logo.svg"
fi

function create_logo() {
    destination=$1
    w=$2
    h=$3
    if [[ $w == $h ]]; then
        res_format="${w}x${h}"
        fill_area_flag=""
        ext_format=$res_format
    else
        min=$((w < h ? w : h))
        res_format="${min}x${min}"
        fill_area_flag="^"
        ext_format="${w}x${h}"
    fi
    convert \
        -background none \
        -density 1000 \
        -fuzz 1% \
        -trim \
        +repage \
        -resize "${res_format}${fill_area_flag}" \
        -gravity center \
        -extent "${ext_format}" \
        "$source" "$destination"
}

create_logo 24.png 24 24
create_logo 44.png 44 44
create_logo 50.png 50 50
create_logo 76.png 76 76
create_logo 88.png 88 88
create_logo 120.png 120 120
create_logo 150.png 150 150
create_logo 152.png 152 152
create_logo 180.png 180 180
create_logo 300.png 300 300
create_logo 1024.png 1024 1024
create_logo 620x300.png 620 300
create_logo 1240x600.png 1240 600
create_logo apple-touch-icon-57.png 57 57
create_logo apple-touch-icon-60.png 60 60
create_logo apple-touch-icon-72.png 72 72
create_logo apple-touch-icon-76.png 76 76
create_logo apple-touch-icon-114.png 114 114
create_logo apple-touch-icon-120.png 120 120
create_logo apple-touch-icon-144.png 144 144
create_logo apple-touch-icon-152.png 152 152
create_logo apple-touch-icon-180.png 180 180
create_logo mstile-70.png 70 70
create_logo mstile-150.png 150 150
create_logo mstile-310.png 310 310
create_logo mstile-310x150.png 310 150

optipng -o7 *.png

convert \
    -background transparent \
    -density 1000 \
    -define icon:auto-resize=16,32,48,64,256 \
    "$source" favicon.ico

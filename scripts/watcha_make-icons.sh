#! /usr/bin/env bash

# usage: run from res/watcha_icons/
# see scripts/make-icons.sh for dependencies

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
        min=$((w<h ? w : h))
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

# manifest.json
create_logo 89ac632f-d735-868d-4b9b-cfe32121294c.webPlatform.png 24 24
create_logo 20587a91-30e9-d583-2b9b-5c4c2aca967f.webPlatform.png 44 44
create_logo 5c925eef-dd2e-aa16-b6d4-13c90b81af1f.webPlatform.png 50 50
create_logo 552c9d70-ff13-2235-8ef9-00db0d2fda0c.webPlatform.png 76 76
create_logo 8f19f71b-ab84-4fe7-1866-8ee9fb1362da.webPlatform.png 88 88
create_logo 4f4b5190-3b9c-9173-3118-442179ae62d4.webPlatform.png 120 120
create_logo dd73cdd3-17c4-9b33-81b8-4789b7a4a250.webPlatform.png 150 150
create_logo 627721aa-5331-ded6-b4a5-0bb4799985ee.webPlatform.png 152 152
create_logo a2e91e68-aa4e-45e7-e5e6-951e1d314675.webPlatform.png 180 180
create_logo 4168a7e5-9d94-e9a3-4e60-45a58cc8ee4e.webPlatform.png 300 300
create_logo b3624ff1-eaf4-1082-4923-949bc8eb40ef.webPlatform.png 620 300
create_logo 32aa4ec4-8b3f-d7b8-e2df-a49ba887199a.webPlatform.png 1024 1024
create_logo 20522817-fde7-6a88-54a9-496b1c8aee53.webPlatform.png 1240 600

optipng -o7 *.png

mkdir -p res/vector-icons
mkdir -p electron_app/{img,build/icons}

../../scripts/make-icons.sh "$source"

mv res/vector-icons/* .

rm -rf res electron_app

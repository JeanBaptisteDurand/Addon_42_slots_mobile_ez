#!/bin/bash
VERSION=$(grep -oP '"version"\s*:\s*"\K[^"]+' 42_slots/manifest.json)
cd 42_slots || exit
zip -r "../42-slots-$VERSION.xpi" . -x ".git/*" "node_modules/*"

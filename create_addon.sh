#!/bin/bash
VERSION=$(grep -oP '"version"\s*:\s*"\K[^"]+' 42_slots/manifest.json)
zip -r "42-slots-$VERSION.xpi" 42_slots -x "42_slots/.git/*" "42_slots/node_modules/*"

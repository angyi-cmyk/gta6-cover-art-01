[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/angyi-cmyk/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/angyi-cmyk/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Neon Coast — GTA-style Cover Studio

A web app that turns your own photo into GTA-style poster art: multi-panel
layouts, bold caption lettering, and a Vice City sunset or neon colour
grade, exported as a PNG to share. Built for the
[make.fun GTA 6 cover art bounty](https://make.fun/bounty/gta6-cover-art-01).

- **Any photo:** upload your own photos, or try the two bundled samples.
  Click a panel to select it, drag to pan, scroll to zoom, fill several
  panels with one photo or several.
- **Four layouts:** Grid 2×2, Hero + 3, Full bleed, Tilted snaps.
- **Five grades:** Sunset, Neon, Vice, Noir, None — plus grain, vignette
  and a halftone title band.
- **Caption:** edit the title and subtitle, resize the lettering, toggle
  the five-star row.
- **Fast and easy:** one click exports a PNG at 1080 × 1080, 1080 × 1350
  or 1920 × 1080.

Everything runs offline in your browser from the static files under `app/`.
Your photos are read on your own machine and never uploaded anywhere.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `buildDossier` library.

## Originality

All artwork is drawn in code by this app. No Rockstar Games logo,
wordmark, official artwork, character or font is used. Fonts are
Liberation Sans under the SIL Open Font License 1.1
(see `app/fonts/OFL-1.1.txt`). Sample photos are AI-generated originals.

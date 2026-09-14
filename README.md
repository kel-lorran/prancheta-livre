# Prancheta Livre

**[kel-lorran.github.io/prancheta-livre](https://kel-lorran.github.io/prancheta-livre/)**

A free, open-source vector sheet editor for architecture drawings — place ISO-sized
sheets on an infinite canvas, import an image exported from SketchUp, calibrate it to
a real architectural scale, and dimension it following Brazilian technical-drawing
conventions (NBR 6492). Runs entirely in the browser: no backend, no account, no
install.

## Why this exists

I'm an architect who models in SketchUp — the free web version, which has real
limitations once you leave the 3D view. My actual workflow was: export a view as an
image, then rebuild it as a proper technical drawing in Inkscape — adding dimension
lines, positioning everything on ISO paper sizes, getting the scale right by hand.
That second step routinely took longer than the modeling itself.

SketchUp's paid tier ships exactly the tool for this — LayOut — but it only makes
sense to pay for it once you have the project volume to justify it. Prancheta Livre
is my own version of that one step: turn an exported raster image into a correctly
scaled, dimensioned, ISO-formatted sheet, fast, for free.

It's a sibling project to [Paginazilla](https://github.com/kel-lorran/paginazilla),
another tool I built to solve a real problem from my own practice, with the same
philosophy: free/open-source stack, static deploy, no backend.

## What it does today

- **Infinite canvas of ISO sheets** — A4 through A0, portrait or landscape, created
  and arranged like frames in a design tool.
- **Import a PNG/JPG** (a SketchUp export, a photo, anything) as a sheet's viewport.
- **Calibrate to a real scale**: click two points spanning a known real-world length,
  type that length and the target plotted scale (1:20 through 1:1000, or a custom
  denominator) — the image is resized so that segment measures exactly right at that
  scale on paper. The scale is then locked.
- **Dimensioning**, two modes:
  - *Ortogonal* — click two points, the tool decides horizontal or vertical
    automatically from their direction.
  - *Alinhada* — follows the exact angle of the segment you clicked.
  - Text position, gaps, tick marks and line weights follow NBR 6492 conventions
    (text above/left of the line, 2mm leader gap, 3mm text height, etc.).
  - Any dimension's text can be overridden, and its offset dragged to reposition.

## Status

Early, functional MVP — the core drawing/dimensioning loop works end to end. There is
no save/reload yet: closing the tab loses your work. See [PLANNING.md](./PLANNING.md)
for the architecture and what's planned next (local auto-save + a portable project
file you can back up or move between machines).

## Development

```bash
npm install
npm run dev
```

## Deploy (GitHub Pages)

Deploys automatically via GitHub Actions (`.github/workflows/deploy.yml`) on every
push to `main`. One-time setup in the repo's GitHub settings: **Settings → Pages →
Source → GitHub Actions**.

The `base` in `vite.config.ts` is fixed to `/prancheta-livre/` — adjust it if the
GitHub repository name differs.

Manual build (no deploy):

```bash
npm run build
```

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

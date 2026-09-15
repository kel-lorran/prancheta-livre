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
- **Annotations**: leader callouts, circled sequential numbering, a dashed level
  reference line, and a detail-reference callout (marks an area and points a label
  at it — see PLANNING.md for how this differs from a real zoomed detail view).
- **Title block** on every sheet — project name/client/author set once, per-sheet
  title/date/revision edited by clicking the field directly; scale and sheet
  number are always derived automatically, never typed by hand.
- **Undo/redo** (toolbar buttons or Ctrl+Z / Ctrl+Shift+Z) across every edit.
- **Autosave** to the browser's local IndexedDB — close the tab, come back later,
  your project is still there.
- **Export**: a vector PDF (one ISO-sized page per sheet, via jsPDF + svg2pdf.js),
  or a portable `.zip` project file (vector data + real images) for backup,
  version control, or moving to another machine.

## Status

Functional MVP with a full local workflow: draw, dimension, annotate, and export —
with autosave so you never lose work, and undo/redo throughout. See
[PLANNING.md](./PLANNING.md) for the full architecture and what's next (angular/
radius dimensions, layers, multiple viewports per sheet, a proper title-block
editor).

## Testing

End-to-end tests (Playwright) cover sheet CRUD, import + calibration, both
dimensioning modes, all four annotation tools, undo/redo, and persistence
(autosave/resume, PDF/zip export):

```bash
npm run test:e2e
```

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

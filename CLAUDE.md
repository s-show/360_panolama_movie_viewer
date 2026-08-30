# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A 360-degree panoramic image/video viewer with annotation capabilities (text labels and arrows), built with Three.js and vanilla JavaScript. The UI is in Japanese.

## Commands

- `pnpm dev` — Start Vite dev server
- `pnpm build` — Production build (outputs a single self-contained HTML file via `vite-plugin-singlefile`)
- `pnpm preview` — Preview production build
- `pnpm lint` — ESLint over `src`, `tests`, and root config files
- `pnpm test` — Unit tests (Vitest, node environment)
- `pnpm test:e2e` — End-to-end tests (Playwright, Chromium)
- `./scripts/check.sh` — The shared verification entry point used by both developers and CI. Runs install → lint → unit → build → e2e. `SKIP_E2E=1` skips the browser tests.

Both npm and pnpm work; pnpm is the primary package manager (pnpm-workspace.yaml, pnpm-lock.yaml present).

## Code Style

ESLint is configured in `.eslint.json`:
- Semicolons required (`"always"`)
- Double quotes required

## Architecture

The entire application lives in two source files:

**`src/main.js`** — All application logic in a single module:
- **Scene setup**: Three.js `PerspectiveCamera`, inverted sphere geometry for panorama projection, `WebGLRenderer`
- **Media loading**: `detectFileType()` reads magic bytes from the file header to distinguish image vs video; `createTexture()` produces either a `TextureLoader` texture or a `VideoTexture`
- **Annotation system**: `createTextSprite()` renders text onto a canvas with black outline and wraps it as a Three.js `Sprite`; `createArrowMesh()` builds an arrow from a cylinder + cone `Group`
- **Interaction**: `OrbitControls` for camera orbit/zoom/pan, `TransformControls` for moving/rotating annotations, raycasting (`getIntersectPoint`, `checkIntersection`) for placing and selecting objects on the sphere
- **UI state**: Mode (`'none'`, `'text'`, `'arrow'`) determines click behavior; a property panel lets users edit selected annotation properties
- **Equirectangular export**: `saveEquirectangularImage()` captures the scene (annotations included) as an equirectangular PNG or JPEG. Uses `CubeCamera` → custom shader (cubemap→equirectangular conversion) → `readRenderTargetPixels` → 2D canvas download. Output resolution matches the source panorama; sRGB color space is preserved via `equirectTarget.texture.colorSpace`
- **`renderScene()`** is the main entry point that wires up all event handlers and the animation loop

**`index.html`** — Contains all UI elements (file input, annotation toolbar, video controls, property panel, view-reset button, format selector and save button). Imports `main.js` as an ES module.

**`src/style.scss`** — All styling; compiled by Vite's built-in Sass support (`sass-embedded`).

## Build Details

`vite.config.js` uses `vite-plugin-singlefile` to inline all JS and CSS into one HTML file for easy distribution. Minification is disabled (`minify: false`).

## Testing

- **`tests/unit/`** (Vitest, `environment: "node"`) — pure logic only: `detectFileType` magic-byte parsing, `clamp`/`adjustTime`, and the arrow/polygon geometry builders. Anything needing Canvas 2D or WebGL is covered by E2E instead.
- **`tests/e2e/`** (Playwright) — runs against the *built* `dist/index.html` served by `vite preview`, so the shipped single-file artifact is what gets tested. `tests/e2e/helpers.js` holds all the shared plumbing.
- **`tests/fixtures/`** — a small synthetic equirectangular PNG/JPEG and a VP9 WebM, committed. `generate.mjs` recreates them (needs ffmpeg; only necessary if the fixture design changes).

Two things make the E2E suite possible:

- **`window.__viewer`** — a read-only hook at the end of `src/main.js`, active in dev and, in production builds, only when the URL contains `e2e`. It exposes camera, scene, annotations, video element, and mode. Without it none of this state is observable: `viewer` is a module-local variable and the `<video>` element is never appended to the DOM.
- **Export verification** — `saveEquirectangularImage` triggers a download by clicking an `<a>` with a data URL. Tests override `HTMLAnchorElement.prototype.click` via `addInitScript` to capture it, then decode the PNG in Node and assert on pixels. Expected pixel positions come from inverting the cubemap→equirectangular shader; see `directionToPixel` in `tests/e2e/helpers.js`.

Export correctness is asserted from colour and geometry rather than golden images, so it stays stable across fonts and renderers: the fixture panorama's band structure must be reproduced at the right position and proportions (this also catches a vertical flip), annotations must appear at the pixel the shader inversion predicts, untouched regions must keep their original colour, and the transform gizmo must be absent (an export with a selection must be byte-identical to one without).

Behavioural quirks the tests have to work around:

- Clicking the exact centre of the canvas (NDC x = 0) cannot place an annotation. The sphere's UV seam lies along +X, which is the initial camera direction, so the ray lands exactly on a triangle boundary and the intersection test rejects it. It is one pixel wide and harmless. `canvasPoint`/`canvasMapper` in `tests/e2e/helpers.js` default to 0.52 to avoid it.
- Finishing a polygon takes a double-click, but the double-click first fires two mousedown/mouseup pairs, each of which adds a vertex. The resulting vertex count is therefore higher than the number of clicks; tests assert `>= 3`.
- Video control buttons keep focus after a click, and `<button>` activates on Space's *keyup*. The keydown handler in `src/media/videoControls.js` calls `e.target.blur()` to cancel that activation — without it, Space both toggles playback and re-triggers whichever button was last used (e.g. skipping 10 s).
- The video keydown listener is registered with the scene's `AbortSignal`. Without it, listeners accumulate per load and discarded video elements keep responding to key presses. `tests/e2e/video.spec.js` has regression tests for both; each was verified to fail with the fix reverted.

## Dev Environment

A Nix flake (`flake.nix`) with direnv provides Node.js 22, pnpm 10, ffmpeg (for fixture generation), and the Playwright browsers via `PLAYWRIGHT_BROWSERS_PATH`. Not required if you have Node.js and pnpm installed otherwise — in that case run `pnpm exec playwright install --with-deps chromium` once.

The `@playwright/test` version in `package.json` is pinned exactly and must match `nixpkgs#playwright-driver`, since the browser revision directory names have to line up. Check with `nix eval --raw nixpkgs#playwright-driver.version` before bumping it.

Japanese text rendering is exercised by the tests, so the environment needs a CJK font (CI installs `fonts-noto-cjk`).

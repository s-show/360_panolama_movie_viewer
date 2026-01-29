# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A 360-degree panoramic image/video viewer with annotation capabilities (text labels and arrows), built with Three.js and vanilla JavaScript. The UI is in Japanese.

## Commands

- `pnpm dev` — Start Vite dev server
- `pnpm build` — Production build (outputs a single self-contained HTML file via `vite-plugin-singlefile`)
- `pnpm preview` — Preview production build

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

## Dev Environment

A Nix flake (`flake.nix`) with direnv provides Node.js 20 and pnpm. Not required if you have Node.js and pnpm installed otherwise.

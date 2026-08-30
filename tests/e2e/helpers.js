import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect } from "@playwright/test";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(here, "..", "fixtures");

// tests/fixtures/generate.mjs と同じ定義。fixture を作り直したら両方合わせること。
export const PANORAMA_WIDTH = 1024;
export const PANORAMA_HEIGHT = 512;
export const REGION_COLORS = {
  up: [0x80, 0x80, 0x80],
  down: [0x40, 0x40, 0x40],
  front: [0x00, 0x00, 0xff],
  right: [0x00, 0xff, 0xff],
  back: [0xff, 0x00, 0xff],
  left: [0xff, 0xff, 0x00]
};

export function fixture(name) {
  return join(FIXTURES, name);
}

/**
 * ビューワーを開く。
 * 本番ビルドでは `?e2e` を付けたときだけ window.__viewer が生える。
 * あわせて、エクスポート時の `<a download>.click()` を横取りして data URL を退避する
 * （equirectExporter は data URL を直接 click させるため、これが最も確実）。
 */
export async function openViewer(page) {
  await page.addInitScript(() => {
    window.__downloads = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (...args) {
      if (this.download) {
        window.__downloads.push({ download: this.download, href: this.href });
        return;
      }
      return originalClick.apply(this, args);
    };
  });
  await page.goto("/?e2e=1");
  await expect(page.locator("#fileSelector")).toBeVisible();
}

/** fixture を読み込み、テクスチャが実際に使える状態になるまで待つ。 */
export async function loadFixture(page, name) {
  await page.locator("#fileSelector").setInputFiles(fixture(name));
  await expect(page.locator("canvas")).toBeVisible();

  await page.waitForFunction(() => {
    const scene = window.__viewer && window.__viewer.scene;
    if (!scene) return false;
    let ready = false;
    scene.traverse((obj) => {
      const image = obj.isMesh && obj.material && obj.material.map && obj.material.map.image;
      if (image && (image.videoWidth || image.naturalWidth || image.width)) ready = true;
    });
    return ready;
  }, undefined, { timeout: 30_000 });

  await nextFrames(page, 3);
}

/** requestAnimationFrame を n 回待つ。 */
export async function nextFrames(page, n = 2) {
  await page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, n);
}

/**
 * OrbitControls は enableDamping が有効なので、マウス操作後もカメラが動き続ける。
 * 姿勢が変化しなくなるまで待つ。
 */
export async function settleCamera(page) {
  await page.waitForFunction(() => {
    const camera = window.__viewer && window.__viewer.camera;
    if (!camera) return false;
    const q = camera.quaternion;
    const now = [q.x, q.y, q.z, q.w];
    const prev = window.__lastQuat;
    window.__lastQuat = now;
    if (!prev) return false;
    return now.every((value, i) => Math.abs(value - prev[i]) < 1e-6);
  }, undefined, { timeout: 10_000 });
  await page.evaluate(() => { delete window.__lastQuat; });
}

/** カメラの向きを方位角（左右）と仰角（上下）で取得する。単位はラジアン。 */
export async function cameraDirection(page) {
  return page.evaluate(() => {
    const camera = window.__viewer.camera;
    const forward = { x: 0, y: 0, z: -1 };
    const q = camera.quaternion;
    // v' = q * v * q^-1 を直接展開する（three をテスト側に持ち込まないため）
    const ix = q.w * forward.x + q.y * forward.z - q.z * forward.y;
    const iy = q.w * forward.y + q.z * forward.x - q.x * forward.z;
    const iz = q.w * forward.z + q.x * forward.y - q.y * forward.x;
    const iw = -q.x * forward.x - q.y * forward.y - q.z * forward.z;
    const x = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y;
    const y = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z;
    const z = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x;
    return {
      vector: { x, y, z },
      azimuth: Math.atan2(x, z),
      elevation: Math.asin(Math.max(-1, Math.min(1, y)))
    };
  });
}

/** -PI..PI に正規化した角度差。 */
export function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** canvas の矩形。 */
export async function canvasBox(page) {
  return page.locator("canvas").boundingBox();
}

/**
 * canvas 上の相対座標を実座標に変換する。
 *
 * 既定値をちょうど中央（0.5, 0.5）にしていないのは意図的。
 * 球ジオメトリの継ぎ目はカメラ初期方向の +X 上にあり、canvas 中央を通るレイは
 * 三角形の境界にちょうど乗るため ray-triangle 判定から外れてクリックが拾われない。
 * 幅 1 ピクセルの現象なので実害は無いが、テストでは避ける。
 */
export async function canvasPoint(page, fx = 0.52, fy = 0.5) {
  const box = await canvasBox(page);
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

/**
 * canvas 上の相対座標 (0..1) を実座標へ変換する関数を返す。
 * 注意: fx = 0.5 ちょうどは球の継ぎ目に当たり、アノテーションを配置できない
 *       （canvasPoint のコメント参照）。0.52 などにずらして使うこと。
 */
export async function canvasMapper(page) {
  const box = await canvasBox(page);
  return (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
}

/** canvas 上をドラッグする（OrbitControls の回転操作）。 */
export async function dragOnCanvas(page, dx, dy, steps = 12) {
  const { x, y } = await canvasPoint(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
  await settleCamera(page);
}

/** 現在のアノテーション一覧を、検証しやすい素の値にして取り出す。 */
export async function annotations(page) {
  return page.evaluate(() => window.__viewer.annotations.map((obj) => {
    const worldPosition = obj.getWorldPosition(new obj.position.constructor());
    return {
      type: obj.userData.type,
      text: obj.userData.text,
      color: obj.userData.color,
      opacity: obj.userData.opacity,
      vertexCount: obj.userData.vertexCount,
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      baseScale: obj.userData.baseScale
        ? { x: obj.userData.baseScale.x, y: obj.userData.baseScale.y }
        : null,
      textureSize: obj.material && obj.material.map && obj.material.map.image
        ? { width: obj.material.map.image.width, height: obj.material.map.image.height }
        : null,
      position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z }
    };
  }));
}

/** テキストを 1 つ追加する。canvas 上の (x, y) をクリックして配置する。 */
export async function addText(page, text, at) {
  await page.locator("#labelTextInput").fill(text);
  await setMode(page, "#toggleAddTextBtn");
  const { x, y } = at ?? await canvasPoint(page);
  await page.mouse.click(x, y);
  await setMode(page, "#toggleAddTextBtn"); // OFF に戻す
}

/** 矢印を 1 つ追加する（2 点間ドラッグ）。 */
export async function addArrow(page, from, to) {
  await setMode(page, "#toggleAddArrowBtn");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await setMode(page, "#toggleAddArrowBtn");
}

/**
 * 多角形を 1 つ追加する。
 * 注意: 最後の dblclick は先に mousedown/mouseup を 2 回発火させるため、
 * 実際の頂点数は points.length + 1 になる（アプリの仕様どおりの挙動）。
 */
export async function addPolygon(page, points) {
  await setMode(page, "#toggleAddPolygonBtn");
  for (const point of points.slice(0, -1)) {
    await page.mouse.click(point.x, point.y);
  }
  const last = points[points.length - 1];
  await page.mouse.dblclick(last.x, last.y);
  await setMode(page, "#toggleAddPolygonBtn");
}

async function setMode(page, selector) {
  await page.locator(selector).click();
}

/** 画像を書き出し、デコード済みの PNG を返す。 */
export async function exportImage(page, format = "png") {
  await page.locator("#saveFormatSelect").selectOption(format);
  await page.evaluate(() => { window.__downloads.length = 0; });
  await page.locator("#saveEquirectBtn").click();

  await page.waitForFunction(() => window.__downloads.length > 0, undefined, { timeout: 90_000 });
  const [download] = await page.evaluate(() => window.__downloads);

  const base64 = download.href.slice(download.href.indexOf(",") + 1);
  const buffer = Buffer.from(base64, "base64");
  return {
    filename: download.download,
    mimeType: download.href.slice("data:".length, download.href.indexOf(";")),
    buffer,
    png: format === "png" ? PNG.sync.read(buffer) : null
  };
}

/**
 * equirectExporter のシェーダ（src/exporter/equirectExporter.js）の逆算。
 *   theta = PI - u * 2PI, phi = v * PI
 *   dir = (sin φ sin θ, cos φ, sin φ cos θ)
 * readRenderTargetPixels の bottom-up と ImageData の top-down が相殺するため、
 * 出力画像の 0 行目が phi = 0（真上）になる。
 */
export function directionToPixel(dir, width, height) {
  const length = Math.hypot(dir.x, dir.y, dir.z);
  const x = dir.x / length, y = dir.y / length, z = dir.z / length;
  const phi = Math.acos(Math.max(-1, Math.min(1, y)));
  const theta = Math.atan2(x, z);
  let u = (Math.PI - theta) / (2 * Math.PI);
  u = ((u % 1) + 1) % 1;
  const v = phi / Math.PI;
  return {
    x: Math.min(width - 1, Math.floor(u * width)),
    y: Math.min(height - 1, Math.floor(v * height))
  };
}

export function pixelAt(png, x, y) {
  const i = ((y % png.height) * png.width + (x % png.width)) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
}

/** 画素を fixture の 6 色のうち最も近いものへ分類する。遠すぎる場合は null。 */
export function classifyRegion([r, g, b], tolerance = 24) {
  let best = null;
  let bestDistance = Infinity;
  for (const [name, color] of Object.entries(REGION_COLORS)) {
    const distance = Math.max(
      Math.abs(r - color[0]),
      Math.abs(g - color[1]),
      Math.abs(b - color[2])
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return bestDistance <= tolerance ? best : null;
}

/** (cx, cy) を中心とする radius 四方に、指定色に近い画素があるか。 */
export function hasColorNear(png, cx, cy, [r, g, b], radius = 24, tolerance = 60) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const y = cy + dy;
      if (y < 0 || y >= png.height) continue;
      const x = ((cx + dx) % png.width + png.width) % png.width;
      const [pr, pg, pb] = pixelAt(png, x, y);
      if (Math.abs(pr - r) <= tolerance && Math.abs(pg - g) <= tolerance && Math.abs(pb - b) <= tolerance) {
        return true;
      }
    }
  }
  return false;
}

/** canvas のスクリーンショットを取り、含まれる色の種類数を数える（真っ黒でないことの確認用）。 */
export async function canvasColorCount(page) {
  const buffer = await page.locator("canvas").screenshot();
  const png = PNG.sync.read(buffer);
  const seen = new Set();
  for (let i = 0; i < png.data.length; i += 4 * 97) {
    seen.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
  }
  return seen.size;
}

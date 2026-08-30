// テスト用 fixture を生成する。生成物はコミットするので、通常は実行不要。
// 画像は pngjs で直接書き出し、JPEG と WebM は ffmpeg に変換させる。
//
//   node tests/fixtures/generate.mjs
//
// ffmpeg が必要（Nix の devShell に含めてある）。
// PNG は再現可能だが、JPEG と WebM は ffmpeg のバージョンでバイト列が変わる。
// テストは色と構造だけを見ているので差分が出ても問題ない。

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));

// パノラマの解像度。equirectangular なので 2:1。
// エクスポート時の出力解像度はこの値と一致するはずなので、小さめにして
// SwiftShader でのテスト時間を抑える。
export const PANORAMA_WIDTH = 1024;
export const PANORAMA_HEIGHT = 512;

// 領域ごとの色。アノテーションの既定色（白=テキスト / 赤=矢印 / 緑=多角形）とは
// 重ならないものを選んでいる。エクスポート画像の画素検証で使う。
export const REGION_COLORS = {
  up: [0x80, 0x80, 0x80],      // 上部 1/4（+Y 方向）
  down: [0x40, 0x40, 0x40],    // 下部 1/4（-Y 方向）
  front: [0x00, 0x00, 0xff],   // 中央帯 u=[0.00,0.25)
  right: [0x00, 0xff, 0xff],   // 中央帯 u=[0.25,0.50)
  back: [0xff, 0x00, 0xff],    // 中央帯 u=[0.50,0.75)
  left: [0xff, 0xff, 0x00]     // 中央帯 u=[0.75,1.00)
};

function regionAt(u, v) {
  if (v < 0.25) return "up";
  if (v >= 0.75) return "down";
  if (u < 0.25) return "front";
  if (u < 0.5) return "right";
  if (u < 0.75) return "back";
  return "left";
}

function buildPanoramaPng() {
  const png = new PNG({ width: PANORAMA_WIDTH, height: PANORAMA_HEIGHT });
  for (let y = 0; y < PANORAMA_HEIGHT; y++) {
    for (let x = 0; x < PANORAMA_WIDTH; x++) {
      const u = x / PANORAMA_WIDTH;
      const v = y / PANORAMA_HEIGHT;
      const [r, g, b] = REGION_COLORS[regionAt(u, v)];
      const i = (y * PANORAMA_WIDTH + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function ffmpeg(args) {
  execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-y", "-loglevel", "error", ...args], {
    stdio: ["ignore", "inherit", "inherit"]
  });
}

const pngPath = join(here, "panorama.png");
const jpgPath = join(here, "panorama.jpg");
const webmPath = join(here, "panorama.webm");

writeFileSync(pngPath, buildPanoramaPng());
console.log("wrote", pngPath);

ffmpeg(["-i", pngPath, "-q:v", "2", jpgPath]);
console.log("wrote", jpgPath);

// 早送り/巻戻しが ±10 秒動くので、30 秒以上の長さが必要。
// 縦帯が横に流れるようにして、フレームごとに絵が変わることを保証する
// （VideoTexture が更新されていることの確認に使う）。
ffmpeg([
  "-loop", "1", "-i", pngPath,
  "-f", "lavfi", "-i", "color=c=red:s=16x256:d=30",
  "-filter_complex",
  "[0:v]scale=512:256[bg];[bg][1:v]overlay=x='mod(t*120,512)':y=0",
  "-t", "30",
  "-r", "10",
  "-c:v", "libvpx-vp9", "-b:v", "150k", "-pix_fmt", "yuv420p",
  "-an", webmPath
]);
console.log("wrote", webmPath);

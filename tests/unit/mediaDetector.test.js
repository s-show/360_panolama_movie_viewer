import { describe, it, expect } from "vitest";
import { detectFileType } from "../../src/media/mediaDetector.js";

// detectFileType は先頭 12 バイトのマジックバイトだけを見るので、
// ヘッダだけのダミーファイルで判定できる。
function fileWith(bytes, name = "dummy.bin") {
  const buf = new Uint8Array(16);
  buf.set(bytes);
  return new File([buf], name);
}

const JPEG = [0xFF, 0xD8, 0xFF, 0xE0];
const PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const BMP = [0x42, 0x4D, 0x00, 0x00];
// MP4 は 4 バイト目からの "ftyp" で判定される
const MP4 = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70];
const WEBM = [0x1A, 0x45, 0xDF, 0xA3];
const FLV = [0x46, 0x4C, 0x56, 0x01];

describe("detectFileType", () => {
  it.each([
    ["JPEG", JPEG],
    ["PNG", PNG],
    ["GIF", GIF],
    ["BMP", BMP]
  ])("%s を image と判定する", async (_name, bytes) => {
    expect(await detectFileType(fileWith(bytes))).toBe("image");
  });

  it.each([
    ["MP4", MP4],
    ["WebM", WEBM],
    ["FLV", FLV]
  ])("%s を video と判定する", async (_name, bytes) => {
    expect(await detectFileType(fileWith(bytes))).toBe("video");
  });

  it("未対応のシグネチャは unknown を返す", async () => {
    expect(await detectFileType(fileWith([0x25, 0x50, 0x44, 0x46]))).toBe("unknown"); // %PDF
    expect(await detectFileType(fileWith([0x50, 0x4B, 0x03, 0x04]))).toBe("unknown"); // ZIP
    expect(await detectFileType(fileWith([0x00, 0x00, 0x00, 0x00]))).toBe("unknown");
  });

  it("拡張子ではなく中身で判定する（拡張子詐称を検出できる）", async () => {
    expect(await detectFileType(fileWith(PNG, "movie.mp4"))).toBe("image");
    expect(await detectFileType(fileWith(MP4, "photo.jpg"))).toBe("video");
  });

  it("8 バイト未満のファイルを MP4 と誤判定しない", async () => {
    // buf.length >= 8 のガードが効いていること
    expect(await detectFileType(new File([new Uint8Array(4)], "tiny.bin"))).toBe("unknown");
  });
});

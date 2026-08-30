import { test, expect } from "@playwright/test";
import { openViewer, loadFixture, canvasColorCount } from "./helpers.js";

test.describe("360度写真・動画の読み込みと表示", () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page);
  });

  test("起動直後は canvas も動画コントロールも出ていない", async ({ page }) => {
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("#videoControls")).toHaveClass(/hidden/);
  });

  test("360度写真を読み込んで表示できる", async ({ page }) => {
    await loadFixture(page, "panorama.png");

    await expect(page.locator("canvas")).toBeVisible();

    // パノラマがテクスチャとして球に貼られていること
    const source = await page.evaluate(() => {
      let size = null;
      window.__viewer.scene.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.map && obj.material.map.image) {
          const image = obj.material.map.image;
          if (image.naturalWidth || image.width) {
            size = { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
          }
        }
      });
      return size;
    });
    expect(source).toEqual({ width: 1024, height: 512 });

    // 実際に描画されている（真っ黒ではない）こと
    expect(await canvasColorCount(page)).toBeGreaterThan(2);

    // 写真ではアノテーションツールと保存ボタンが出て、動画コントロールは隠れる
    await expect(page.locator("#textToolControls")).not.toHaveClass(/hidden/);
    await expect(page.locator("#saveImageDiv")).not.toHaveClass(/hidden/);
    await expect(page.locator("#videoControls")).toHaveClass(/hidden/);
  });

  test("JPEG の360度写真も読み込める", async ({ page }) => {
    await loadFixture(page, "panorama.jpg");
    expect(await canvasColorCount(page)).toBeGreaterThan(2);
  });

  test("360度動画を読み込んで再生できる", async ({ page }) => {
    await loadFixture(page, "panorama.webm");

    const video = await page.evaluate(() => {
      const v = window.__viewer.video;
      return v && { readyState: v.readyState, width: v.videoWidth, height: v.videoHeight, duration: v.duration };
    });
    expect(video).not.toBeNull();
    expect(video.readyState).toBeGreaterThanOrEqual(2);
    expect(video.width).toBe(512);
    expect(video.height).toBe(256);
    // 早送り・巻戻しの検証に足りる長さがあること
    expect(video.duration).toBeGreaterThan(25);

    expect(await canvasColorCount(page)).toBeGreaterThan(2);

    // 動画では動画コントロールが出て、アノテーションツールと保存ボタンは隠れる
    await expect(page.locator("#videoControls")).not.toHaveClass(/hidden/);
    await expect(page.locator("#textToolControls")).toHaveClass(/hidden/);
    await expect(page.locator("#saveImageDiv")).toHaveClass(/hidden/);
  });

  test("画像でも動画でもないファイルは拒否される", async ({ page }) => {
    const messages = [];
    page.on("dialog", (dialog) => {
      messages.push(dialog.message());
      dialog.dismiss();
    });

    await page.locator("#fileSelector").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("これは画像でも動画でもありません")
    });

    await expect.poll(() => messages).toContain("画像または動画ファイルを選択してください");
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});

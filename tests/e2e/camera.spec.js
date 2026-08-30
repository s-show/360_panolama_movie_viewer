import { test, expect } from "@playwright/test";
import {
  openViewer,
  loadFixture,
  cameraDirection,
  angleDelta,
  dragOnCanvas,
  settleCamera,
  canvasColorCount
} from "./helpers.js";

test.describe("カメラの向き", () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page);
    await loadFixture(page, "panorama.png");
    await settleCamera(page);
  });

  test("左右にドラッグすると左右方向に向きが変わる", async ({ page }) => {
    const initial = await cameraDirection(page);

    await dragOnCanvas(page, 300, 0);
    const right = await cameraDirection(page);

    const azimuthDelta = angleDelta(right.azimuth, initial.azimuth);
    // 左右方向に十分動いていること
    expect(Math.abs(azimuthDelta)).toBeGreaterThan(0.1);
    // 上下方向はほとんど動いていないこと（軸が混ざっていない）
    expect(Math.abs(right.elevation - initial.elevation)).toBeLessThan(0.02);

    // 逆向きにドラッグすると反対方向へ動く
    await dragOnCanvas(page, -300, 0);
    const back = await cameraDirection(page);
    const returnDelta = angleDelta(back.azimuth, right.azimuth);
    expect(Math.sign(returnDelta)).toBe(-Math.sign(azimuthDelta));
    // ほぼ元の向きに戻ること
    expect(Math.abs(angleDelta(back.azimuth, initial.azimuth))).toBeLessThan(0.02);
  });

  test("上下にドラッグすると上下方向に向きが変わる", async ({ page }) => {
    const initial = await cameraDirection(page);

    await dragOnCanvas(page, 0, 150);
    const afterDown = await cameraDirection(page);
    const downDelta = afterDown.elevation - initial.elevation;
    expect(Math.abs(downDelta)).toBeGreaterThan(0.1);
    // 左右方向はほとんど動いていないこと
    expect(Math.abs(angleDelta(afterDown.azimuth, initial.azimuth))).toBeLessThan(0.02);

    await dragOnCanvas(page, 0, -300);
    const afterUp = await cameraDirection(page);
    const upDelta = afterUp.elevation - afterDown.elevation;
    // 反対方向へ動くこと
    expect(Math.sign(upDelta)).toBe(-Math.sign(downDelta));
  });

  test("真上・真下を越えて反転しない", async ({ page }) => {
    await dragOnCanvas(page, 0, 2000);
    const bottom = await cameraDirection(page);
    expect(bottom.elevation).toBeGreaterThanOrEqual(-Math.PI / 2 - 0.01);
    expect(bottom.elevation).toBeLessThanOrEqual(Math.PI / 2 + 0.01);

    await dragOnCanvas(page, 0, -4000);
    const top = await cameraDirection(page);
    expect(top.elevation).toBeGreaterThanOrEqual(-Math.PI / 2 - 0.01);
    expect(top.elevation).toBeLessThanOrEqual(Math.PI / 2 + 0.01);
  });

  test("向きを変えると表示される内容も変わる", async ({ page }) => {
    // 中央帯（4色）から真上（単色）へ向けると、見える色数が減る
    const before = await canvasColorCount(page);
    await dragOnCanvas(page, 0, -1200);
    const after = await canvasColorCount(page);
    expect(after).not.toBe(before);
  });

  test("視点初期化ボタンで元の向きに戻る", async ({ page }) => {
    const initial = await cameraDirection(page);

    await dragOnCanvas(page, 400, 200);
    const moved = await cameraDirection(page);
    expect(Math.abs(angleDelta(moved.azimuth, initial.azimuth))).toBeGreaterThan(0.1);
    expect(Math.abs(moved.elevation - initial.elevation)).toBeGreaterThan(0.1);

    await page.locator("#controlResetBtn").click();
    await settleCamera(page);

    const reset = await cameraDirection(page);
    expect(Math.abs(angleDelta(reset.azimuth, initial.azimuth))).toBeLessThan(0.01);
    expect(Math.abs(reset.elevation - initial.elevation)).toBeLessThan(0.01);
  });

  test("初期化した後もさらに操作できる", async ({ page }) => {
    await dragOnCanvas(page, 400, 0);
    await page.locator("#controlResetBtn").click();
    await settleCamera(page);
    const reset = await cameraDirection(page);

    await dragOnCanvas(page, 300, 0);
    const moved = await cameraDirection(page);
    expect(Math.abs(angleDelta(moved.azimuth, reset.azimuth))).toBeGreaterThan(0.1);
  });

  test("動画でもカメラの向きを変更・初期化できる", async ({ page }) => {
    await loadFixture(page, "panorama.webm");
    await settleCamera(page);
    const initial = await cameraDirection(page);

    await dragOnCanvas(page, 300, 120);
    const moved = await cameraDirection(page);
    expect(Math.abs(angleDelta(moved.azimuth, initial.azimuth))).toBeGreaterThan(0.1);

    await page.locator("#controlResetBtn").click();
    await settleCamera(page);
    const reset = await cameraDirection(page);
    expect(Math.abs(angleDelta(reset.azimuth, initial.azimuth))).toBeLessThan(0.01);
    expect(Math.abs(reset.elevation - initial.elevation)).toBeLessThan(0.01);
  });
});

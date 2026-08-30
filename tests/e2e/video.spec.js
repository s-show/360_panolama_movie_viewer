import { test, expect } from "@playwright/test";
import { openViewer, loadFixture, canvasPoint, nextFrames } from "./helpers.js";

const videoState = (page) => page.evaluate(() => {
  const v = window.__viewer.video;
  return { paused: v.paused, currentTime: v.currentTime, duration: v.duration };
});

/** 再生位置が指定秒数の近くに落ち着くまで待つ（seek は非同期）。 */
async function expectTimeNear(page, seconds, tolerance = 1.5) {
  await expect.poll(
    async () => Math.abs((await videoState(page)).currentTime - seconds) <= tolerance,
    { message: `currentTime should settle near ${seconds}s` }
  ).toBe(true);
}

async function pause(page) {
  if ((await videoState(page)).paused) return;
  await page.locator("#playPauseBtn").click();
  await expect.poll(async () => (await videoState(page)).paused).toBe(true);
}

test.describe("360度動画の再生コントロール", () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page);
    await loadFixture(page, "panorama.webm");
  });

  test("読み込み直後は自動再生されている", async ({ page }) => {
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
    // 実際に時間が進むこと
    const first = (await videoState(page)).currentTime;
    await expect.poll(async () => (await videoState(page)).currentTime > first).toBe(true);
  });

  test("一時停止ボタンで停止し、もう一度押すと再生される", async ({ page }) => {
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);

    await page.locator("#playPauseBtn").click();
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);

    // 停止中は時間が進まないこと
    const stopped = (await videoState(page)).currentTime;
    await page.waitForTimeout(500);
    expect((await videoState(page)).currentTime).toBeCloseTo(stopped, 3);

    await page.locator("#playPauseBtn").click();
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
    await expect.poll(async () => (await videoState(page)).currentTime > stopped).toBe(true);
  });

  test("一時停止/再生でボタンのアイコンが切り替わる", async ({ page }) => {
    const button = page.locator("#playPauseBtn");
    const pathData = () => button.locator("path").getAttribute("d");

    // 再生中は一時停止アイコン（縦二本線）
    const playingIcon = await pathData();
    expect(playingIcon).toContain("M6 19h4V5H6v14z");

    await button.click();
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);

    // 停止中は再生アイコン（三角）
    const pausedIcon = await pathData();
    expect(pausedIcon).not.toBe(playingIcon);
    expect(pausedIcon).toContain("M8 5v14l11-7z");
  });

  test("早送りボタンで 10 秒進む", async ({ page }) => {
    await pause(page);
    await page.evaluate(() => { window.__viewer.video.currentTime = 5; });
    await expectTimeNear(page, 5, 0.5);

    await page.locator("#fastForwardBtn").click();
    await expectTimeNear(page, 15);
  });

  test("巻戻しボタンで 10 秒戻る", async ({ page }) => {
    await pause(page);
    await page.evaluate(() => { window.__viewer.video.currentTime = 20; });
    await expectTimeNear(page, 20, 0.5);

    await page.locator("#rewindBtn").click();
    await expectTimeNear(page, 10);
  });

  test("先頭より前へは戻らない", async ({ page }) => {
    await pause(page);
    await page.evaluate(() => { window.__viewer.video.currentTime = 3; });
    await expectTimeNear(page, 3, 0.5);

    await page.locator("#rewindBtn").click();
    await expect.poll(async () => (await videoState(page)).currentTime).toBeLessThanOrEqual(0.5);
    await expect.poll(async () => (await videoState(page)).currentTime).toBeGreaterThanOrEqual(0);
  });

  test("末尾より先へは進まない", async ({ page }) => {
    await pause(page);
    const { duration } = await videoState(page);
    await page.evaluate((d) => { window.__viewer.video.currentTime = d - 3; }, duration);
    await expectTimeNear(page, duration - 3, 0.5);

    await page.locator("#fastForwardBtn").click();
    await expect.poll(async () => (await videoState(page)).currentTime).toBeLessThanOrEqual(duration + 0.01);
    await expect.poll(async () => (await videoState(page)).currentTime).toBeGreaterThan(duration - 1.5);
  });

  test("Space キーで再生/停止を切り替えられる", async ({ page }) => {
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);

    await page.keyboard.press("Space");
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);

    await page.keyboard.press("Space");
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
  });

  test("ボタンを押した直後の Space キーでも 1 回だけトグルされる", async ({ page }) => {
    // ボタンをクリックするとフォーカスが残る。この状態で Space を押すと
    // 「ボタンの再活性化」と document の keydown が二重に発火し、
    // 2 回トグルして無反応に見えてしまう。keydown 側で blur して防いでいる。
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);

    await page.locator("#playPauseBtn").click();
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);
    expect(await page.evaluate(() => document.activeElement.id)).toBe("playPauseBtn");

    await page.keyboard.press("Space");
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
    // フォーカスがボタンから外れていること
    expect(await page.evaluate(() => document.activeElement.id)).not.toBe("playPauseBtn");

    await page.keyboard.press("Space");
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);
  });

  test("早送りボタンを押した直後の Space キーは再生位置を動かさない", async ({ page }) => {
    await pause(page);
    await page.evaluate(() => { window.__viewer.video.currentTime = 5; });
    await expectTimeNear(page, 5, 0.5);

    await page.locator("#fastForwardBtn").click();
    await expectTimeNear(page, 15);
    expect(await page.evaluate(() => document.activeElement.id)).toBe("fastForwardBtn");

    // blur していないと Space が早送りボタンも再活性化させ、
    // 再生開始と同時に 10 秒飛んでしまう。
    await page.keyboard.press("Space");
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
    expect((await videoState(page)).currentTime).toBeLessThan(20);
  });

  test("動画を読み込み直すと、古い動画はキー操作に反応しなくなる", async ({ page }) => {
    // addVideoControls の keydown リスナーが AbortSignal で解除されていないと、
    // 読み込むたびにリスナーが増え、破棄したはずの古い動画がキー操作で
    // 再生され続ける（デコードが止まらない）。
    await pause(page);
    await page.evaluate(() => {
      window.__oldVideo = window.__viewer.video;
      window.__oldVideo.currentTime = 8;
    });

    await loadFixture(page, "panorama.png");
    await loadFixture(page, "panorama.webm");
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);

    await page.keyboard.press("Space");
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);

    // 現在の動画だけが操作されること
    await page.evaluate(() => { window.__viewer.video.currentTime = 5; });
    await expectTimeNear(page, 5, 0.5);
    await page.keyboard.press("ArrowRight");
    await expectTimeNear(page, 15);

    // 古い動画は停止したまま、再生位置も動いていないこと
    const old = await page.evaluate(() => ({
      paused: window.__oldVideo.paused,
      currentTime: window.__oldVideo.currentTime
    }));
    expect(old.paused).toBe(true);
    expect(old.currentTime).toBeCloseTo(8, 0);
  });

  test("画像を読み込むと動画用のキー操作は解除される", async ({ page }) => {
    // 停止させてボタンを再生アイコンにしておく
    await pause(page);
    const iconWhilePaused = await page.locator("#playPauseBtn").innerHTML();

    await loadFixture(page, "panorama.png");
    expect(await page.evaluate(() => window.__viewer.video)).toBeNull();

    // リスナーが残っていると、破棄したはずの動画を再生してアイコンが変わる
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);

    expect(await page.locator("#playPauseBtn").innerHTML()).toBe(iconWhilePaused);
    expect(errors).toEqual([]);
  });

  test("矢印キーで早送り・巻戻しができる", async ({ page }) => {
    await page.keyboard.press("Space");
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);

    await page.evaluate(() => { window.__viewer.video.currentTime = 12; });
    await expectTimeNear(page, 12, 0.5);

    await page.keyboard.press("ArrowRight");
    await expectTimeNear(page, 22);

    await page.keyboard.press("ArrowLeft");
    await expectTimeNear(page, 12);
  });

  test("canvas のクリックでも再生/停止が切り替わる", async ({ page }) => {
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);

    const { x, y } = await canvasPoint(page);
    await page.mouse.click(x, y);
    await expect.poll(async () => (await videoState(page)).paused).toBe(true);

    await page.mouse.click(x, y);
    await expect.poll(async () => (await videoState(page)).paused).toBe(false);
  });

  test("再生の進行に合わせて描画内容が更新される", async ({ page }) => {
    // fixture には横に流れる赤帯が焼き込んであるので、
    // 再生が進めば canvas の見た目が変わる。
    const snapshot = async () => {
      await nextFrames(page, 2);
      return (await page.locator("canvas").screenshot()).toString("base64");
    };

    const before = await snapshot();
    await page.waitForTimeout(700);
    const after = await snapshot();
    expect(after).not.toBe(before);
  });
});

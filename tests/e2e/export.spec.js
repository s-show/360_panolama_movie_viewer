import { test, expect } from "@playwright/test";
import {
  openViewer,
  loadFixture,
  annotations,
  addText,
  addArrow,
  addPolygon,
  canvasMapper,
  settleCamera,
  exportImage,
  directionToPixel,
  pixelAt,
  classifyRegion,
  hasColorNear,
  PANORAMA_WIDTH,
  PANORAMA_HEIGHT,
  REGION_COLORS
} from "./helpers.js";

// CubeCamera が 2048px 立方体を 6 面レンダリングするため、
// ソフトウェアレンダリングでは 1 回の書き出しに時間がかかる。
test.describe.configure({ timeout: 180_000 });

test.describe("equirectangular 画像のエクスポート", () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page);
    await loadFixture(page, "panorama.png");
    await settleCamera(page);
  });

  test("PNG で保存でき、元のパノラマと同じ解像度になる", async ({ page }) => {
    const result = await exportImage(page, "png");

    expect(result.filename).toBe("equirectangular.png");
    expect(result.mimeType).toBe("image/png");
    expect(result.png.width).toBe(PANORAMA_WIDTH);
    expect(result.png.height).toBe(PANORAMA_HEIGHT);
  });

  test("JPEG でも保存できる", async ({ page }) => {
    const result = await exportImage(page, "jpeg");

    expect(result.filename).toBe("equirectangular.jpg");
    expect(result.mimeType).toBe("image/jpeg");
    // JPEG のマジックバイト
    expect(result.buffer[0]).toBe(0xFF);
    expect(result.buffer[1]).toBe(0xD8);
    expect(result.buffer.length).toBeGreaterThan(1000);
  });

  test("元パノラマの上下の帯と中央 4 分割が崩れずに再現される", async ({ page }) => {
    const { png } = await exportImage(page, "png");

    // 全画素が不透明であること（欠けが無い）
    for (let y = 0; y < png.height; y += 37) {
      for (let x = 0; x < png.width; x += 41) {
        expect(pixelAt(png, x, y)[3]).toBe(255);
      }
    }

    // 上端付近は「上」の色、下端付近は「下」の色。
    // 上下が入れ替わっていないこと（縦方向の反転が無いこと）の確認でもある。
    for (let x = 0; x < png.width; x += 32) {
      expect(classifyRegion(pixelAt(png, x, 10))).toBe("up");
      expect(classifyRegion(pixelAt(png, x, png.height - 10))).toBe("down");
    }

    // 中央の帯は 4 色の縦ストライプになる。
    // 経度の原点はエクスポート側の定義に依存するので、色の並びは
    // 「4 色がそれぞれ帯の 1/4 ずつを占める」ことで確認する。
    const midY = Math.floor(png.height / 2);
    const counts = {};
    for (let x = 0; x < png.width; x++) {
      const region = classifyRegion(pixelAt(png, x, midY));
      counts[region] = (counts[region] ?? 0) + 1;
    }
    for (const name of ["front", "right", "back", "left"]) {
      expect(counts[name], `中央帯に ${name} の領域が 1/4 幅あること`)
        .toBeGreaterThan(png.width / 4 * 0.9);
      expect(counts[name]).toBeLessThan(png.width / 4 * 1.1);
    }
    // 中央帯に上下の色が混ざっていないこと
    expect(counts.up ?? 0).toBe(0);
    expect(counts.down ?? 0).toBe(0);
    // どの色にも分類できない画素は、ストライプ境界の混色だけ（数ピクセル）
    expect(counts.null ?? 0).toBeLessThan(png.width * 0.02);

    // 上下の境界が正しい高さ（v=0.25 / 0.75）にあること
    const column = 200;
    let upEnd = 0;
    while (classifyRegion(pixelAt(png, column, upEnd)) === "up") upEnd++;
    expect(upEnd / png.height).toBeCloseTo(0.25, 1);

    let downStart = png.height - 1;
    while (classifyRegion(pixelAt(png, column, downStart)) === "down") downStart--;
    expect(downStart / png.height).toBeCloseTo(0.75, 1);
  });

  test("追加した文字がエクスポート画像の正しい位置に含まれる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "EXPORT", at(0.52, 0.5));

    const [item] = await annotations(page);
    const { png } = await exportImage(page, "png");

    // テキストは白（既定色）。アノテーションの実際の3D位置から
    // シェーダの式を逆算した座標の周辺に白い画素があること。
    const expected = directionToPixel(item.position, png.width, png.height);
    expect(
      hasColorNear(png, expected.x, expected.y, [255, 255, 255], 40, 40),
      `(${expected.x}, ${expected.y}) 付近に白い文字があること`
    ).toBe(true);

    // 元のパノラマは白を含まないので、白が出るのは追加した文字だけ
    let whitePixels = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i] > 230 && png.data[i + 1] > 230 && png.data[i + 2] > 230) whitePixels++;
    }
    expect(whitePixels).toBeGreaterThan(50);
  });

  test("日本語の文字もエクスポートできる", async ({ page }) => {
    const at = await canvasMapper(page);
    await page.locator("#textColorPicker").fill("#ffffff");
    await addText(page, "非常口はこちら", at(0.52, 0.5));

    const [item] = await annotations(page);
    const { png } = await exportImage(page, "png");

    const expected = directionToPixel(item.position, png.width, png.height);
    expect(hasColorNear(png, expected.x, expected.y, [255, 255, 255], 60, 40)).toBe(true);
  });

  test("文字・矢印・多角形がすべてエクスポートされる", async ({ page }) => {
    const at = await canvasMapper(page);

    await page.locator("#textColorPicker").fill("#ffffff");
    await addText(page, "TEXT", at(0.35, 0.4));

    await page.locator("#arrowColorPicker").fill("#ff0000");
    await addArrow(page, at(0.55, 0.62), at(0.68, 0.44));

    await page.locator("#polygonColorPicker").fill("#00ff00");
    await page.locator("#polygonOpacitySlider").fill("1");
    await addPolygon(page, [at(0.3, 0.62), at(0.44, 0.62), at(0.44, 0.75), at(0.3, 0.75)]);

    const items = await annotations(page);
    expect(items).toHaveLength(3);

    const { png } = await exportImage(page, "png");

    const cases = [
      ["テキスト", items[0], [255, 255, 255], 40],
      ["矢印", items[1], [255, 0, 0], 60],
      ["多角形", items[2], [0, 255, 0], 60]
    ];
    for (const [label, item, color, radius] of cases) {
      const expected = directionToPixel(item.position, png.width, png.height);
      expect(
        hasColorNear(png, expected.x, expected.y, color, radius, 60),
        `${label} が (${expected.x}, ${expected.y}) 付近に描画されていること`
      ).toBe(true);
    }
  });

  test("アノテーションを追加しても他の領域の色は変化しない", async ({ page }) => {
    const before = (await exportImage(page, "png")).png;

    const at = await canvasMapper(page);
    await addText(page, "HERE", at(0.52, 0.5));
    const [item] = await annotations(page);

    const after = (await exportImage(page, "png")).png;
    const annotationAt = directionToPixel(item.position, after.width, after.height);

    // アノテーションから十分離れた画素は、追加前と同じ領域色のままであること
    let compared = 0;
    for (let y = 5; y < after.height; y += 23) {
      for (let x = 0; x < after.width; x += 29) {
        const dx = Math.min(
          Math.abs(x - annotationAt.x),
          after.width - Math.abs(x - annotationAt.x)
        );
        if (dx < 150 && Math.abs(y - annotationAt.y) < 150) continue;
        expect(classifyRegion(pixelAt(after, x, y))).toBe(classifyRegion(pixelAt(before, x, y)));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(200);
  });

  test("編集ギズモはエクスポート画像に写り込まない", async ({ page }) => {
    const at = await canvasMapper(page);
    await addPolygon(page, [at(0.42, 0.42), at(0.6, 0.42), at(0.6, 0.6), at(0.42, 0.6)]);

    // 未選択（ギズモなし）で書き出す
    const unselected = (await exportImage(page, "png")).png;

    // 選択してギズモを表示させる
    const center = at(0.52, 0.5);
    await page.mouse.click(center.x, center.y);
    await expect(page.locator("#propertyPanel")).not.toHaveClass(/hidden/);
    expect(await page.evaluate(() => window.__viewer.transformControl.getHelper().visible)).toBe(true);

    const selected = (await exportImage(page, "png")).png;

    // ギズモが除外されていれば、2 枚は同じ絵になる
    expect(selected.width).toBe(unselected.width);
    expect(selected.height).toBe(unselected.height);
    let differing = 0;
    for (let i = 0; i < selected.data.length; i += 4) {
      if (
        Math.abs(selected.data[i] - unselected.data[i]) > 2 ||
        Math.abs(selected.data[i + 1] - unselected.data[i + 1]) > 2 ||
        Math.abs(selected.data[i + 2] - unselected.data[i + 2]) > 2
      ) {
        differing++;
      }
    }
    expect(differing).toBe(0);

    // 書き出し後もギズモは元どおり表示に戻っていること
    expect(await page.evaluate(() => window.__viewer.transformControl.getHelper().visible)).toBe(true);
  });

  test("視点を動かしてもエクスポート結果は変わらない（全天球を書き出している）", async ({ page }) => {
    const before = (await exportImage(page, "png")).png;

    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(800, 450, { steps: 10 });
    await page.mouse.up();
    await settleCamera(page);

    const after = (await exportImage(page, "png")).png;

    let sampled = 0;
    for (let y = 5; y < after.height; y += 31) {
      for (let x = 0; x < after.width; x += 37) {
        expect(classifyRegion(pixelAt(after, x, y))).toBe(classifyRegion(pixelAt(before, x, y)));
        sampled++;
      }
    }
    expect(sampled).toBeGreaterThan(100);
  });

  test("背景色は元のパノラマの色をそのまま保つ", async ({ page }) => {
    const { png } = await exportImage(page, "png");

    // 各領域の代表点が、fixture の色とほぼ一致すること（色空間の往復で崩れない）
    const samples = [
      [png.width / 2, 20, REGION_COLORS.up],
      [png.width / 2, png.height - 20, REGION_COLORS.down]
    ];
    for (const [x, y, expected] of samples) {
      const [r, g, b] = pixelAt(png, Math.floor(x), Math.floor(y));
      expect(Math.abs(r - expected[0])).toBeLessThanOrEqual(6);
      expect(Math.abs(g - expected[1])).toBeLessThanOrEqual(6);
      expect(Math.abs(b - expected[2])).toBeLessThanOrEqual(6);
    }
  });
});

import { test, expect } from "@playwright/test";
import {
  openViewer,
  loadFixture,
  annotations,
  addText,
  addArrow,
  addPolygon,
  canvasMapper,
  canvasPoint,
  settleCamera
} from "./helpers.js";

test.describe("アノテーションの追加", () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page);
    await loadFixture(page, "panorama.png");
    await settleCamera(page);
  });

  test("文字を追加できる", async ({ page }) => {
    await addText(page, "Label A");

    const items = await annotations(page);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("text");
    expect(items[0].text).toBe("Label A");
    // 実際に文字が描かれたテクスチャが生成されていること
    expect(items[0].textureSize.width).toBeGreaterThan(0);
    expect(items[0].textureSize.height).toBeGreaterThan(0);
  });

  test("日本語の文字も追加できる", async ({ page }) => {
    await addText(page, "日本語のラベル");

    const items = await annotations(page);
    expect(items[0].text).toBe("日本語のラベル");
    expect(items[0].textureSize.width).toBeGreaterThan(0);
  });

  test("日本語は豆腐文字にならず、文字数に応じた幅で描画される", async ({ page }) => {
    // フォントが日本語グリフを持たないと全文字が同じ幅の代替字形になり、
    // 「あ」と「ああああああ」の幅比が文字数どおりにならない。
    await addText(page, "あ");
    await addText(page, "ああああああ");

    const [one, six] = await annotations(page);
    const ratio = six.textureSize.width / one.textureSize.width;
    expect(ratio).toBeGreaterThan(3);

    // 日本語は全角なので、同じ文字数の ASCII より横に広いはず
    await addText(page, "aaaaaa");
    const [, , ascii] = await annotations(page);
    expect(six.textureSize.width).toBeGreaterThan(ascii.textureSize.width);
  });

  test("ASCII と日本語を混在させて追加できる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Exit", at(0.35, 0.45));
    await addText(page, "非常口", at(0.6, 0.55));

    const items = await annotations(page);
    expect(items.map(i => i.text)).toEqual(["Exit", "非常口"]);
  });

  test("矢印を追加できる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addArrow(
      page,
      at(0.4, 0.6),
      at(0.6, 0.4)
    );

    const items = await annotations(page);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("arrow");
    expect(items[0].color).toBe("#ff0000");
  });

  test("多角形を追加できる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addPolygon(page, [
      at(0.4, 0.4),
      at(0.6, 0.4),
      at(0.6, 0.6),
      at(0.4, 0.6)
    ]);

    const items = await annotations(page);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("polygon");
    // dblclick が mousedown/mouseup を余分に発火させるため、頂点はクリック数より多くなる
    expect(items[0].vertexCount).toBeGreaterThanOrEqual(3);
    expect(items[0].opacity).toBe(0.5);
  });

  test("頂点が 3 つ未満の多角形は作られない", async ({ page }) => {
    const messages = [];
    page.on("dialog", (dialog) => {
      messages.push(dialog.message());
      dialog.dismiss();
    });

    const { x, y } = await canvasPoint(page);
    await page.locator("#toggleAddPolygonBtn").click();
    await page.mouse.dblclick(x, y);

    await expect.poll(() => messages).toContain("多角形を作成するには3つ以上の頂点が必要です");
    expect(await annotations(page)).toHaveLength(0);
  });

  test("文字・矢印・多角形を 2 つ以上まとめて追加できる", async ({ page }) => {
    const at = await canvasMapper(page);

    await addText(page, "One", at(0.3, 0.35));
    await addText(page, "ふたつめ", at(0.7, 0.35));
    await addArrow(page, at(0.3, 0.5), at(0.45, 0.6));
    await addArrow(page, at(0.6, 0.5), at(0.75, 0.6));
    await addPolygon(page, [at(0.35, 0.7), at(0.5, 0.7), at(0.45, 0.8)]);
    await addPolygon(page, [at(0.6, 0.7), at(0.75, 0.7), at(0.7, 0.8)]);

    const items = await annotations(page);
    expect(items).toHaveLength(6);
    expect(items.filter(i => i.type === "text")).toHaveLength(2);
    expect(items.filter(i => i.type === "arrow")).toHaveLength(2);
    expect(items.filter(i => i.type === "polygon")).toHaveLength(2);
  });

  test("追加した色は選択したカラーピッカーの値になる", async ({ page }) => {
    const at = await canvasMapper(page);

    await page.locator("#textColorPicker").fill("#ff8800");
    await addText(page, "Colored", at(0.4, 0.4));

    await page.locator("#arrowColorPicker").fill("#0088ff");
    await addArrow(page, at(0.4, 0.6), at(0.6, 0.7));

    await page.locator("#polygonColorPicker").fill("#88ff00");
    await page.locator("#polygonOpacitySlider").fill("0.8");
    await addPolygon(page, [at(0.6, 0.4), at(0.75, 0.4), at(0.7, 0.5)]);

    const [text, arrow, polygon] = await annotations(page);
    expect(text.color).toBe("#ff8800");
    expect(arrow.color).toBe("#0088ff");
    expect(polygon.color).toBe("#88ff00");
    expect(polygon.opacity).toBe(0.8);
  });

  test("テキスト未入力でクリックすると警告が出て追加されない", async ({ page }) => {
    const messages = [];
    page.on("dialog", (dialog) => {
      messages.push(dialog.message());
      dialog.dismiss();
    });

    await page.locator("#toggleAddTextBtn").click();
    const { x, y } = await canvasPoint(page);
    await page.mouse.click(x, y);

    await expect.poll(() => messages).toContain("ラベルテキストを入力してください");
    expect(await annotations(page)).toHaveLength(0);
  });

  test("モード切り替えボタンの表示が ON / OFF で変わる", async ({ page }) => {
    const button = page.locator("#toggleAddTextBtn");
    await expect(button).toHaveText("テキスト: OFF");
    await button.click();
    await expect(button).toHaveText("テキスト: ON");
    await expect.poll(() => page.evaluate(() => window.__viewer.mode)).toBe("text");

    // Escape で解除できる
    await page.keyboard.press("Escape");
    await expect(button).toHaveText("テキスト: OFF");
    await expect.poll(() => page.evaluate(() => window.__viewer.mode)).toBe("none");
  });
});

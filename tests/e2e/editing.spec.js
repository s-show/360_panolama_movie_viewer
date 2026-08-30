import { test, expect } from "@playwright/test";
import {
  openViewer,
  loadFixture,
  annotations,
  addText,
  addArrow,
  addPolygon,
  canvasMapper,
  settleCamera
} from "./helpers.js";

/** 直前に追加したアノテーションをクリックして選択する。 */
async function select(page, at) {
  await page.mouse.click(at.x, at.y);
  await expect(page.locator("#propertyPanel")).not.toHaveClass(/hidden/);
}

test.describe("アノテーションの編集", () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page);
    await loadFixture(page, "panorama.png");
    await settleCamera(page);
  });

  test("テキストをクリックすると編集パネルが開く", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Before", at(0.52, 0.5));
    await select(page, at(0.52, 0.5));

    await expect(page.locator("#textProperties")).not.toHaveClass(/hidden/);
    await expect(page.locator("#editTextInput")).toHaveValue("Before");
    await expect(page.locator("#polygonProperties")).toHaveClass(/hidden/);
    // テキストは移動のみ（回転ボタンは隠れる）
    await expect(page.locator("#modeRotateBtn")).toHaveClass(/hidden/);

    await expect.poll(() => page.evaluate(() => window.__viewer.selected !== null)).toBe(true);
  });

  test("テキストの内容を書き換えられる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Before", at(0.52, 0.5));
    await select(page, at(0.52, 0.5));

    await page.locator("#editTextInput").fill("編集後のテキスト");

    const [item] = await annotations(page);
    expect(item.text).toBe("編集後のテキスト");
    // 文字数が増えたのでテクスチャも作り直されていること
    expect(item.textureSize.width).toBeGreaterThan(0);
  });

  test("テキストのサイズを変更できる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Size", at(0.52, 0.5));
    await select(page, at(0.52, 0.5));

    const [before] = await annotations(page);
    expect(before.scale.x / before.baseScale.x).toBeCloseTo(1.0, 5);

    await page.locator("#editTextSize").fill("2.5");

    const [after] = await annotations(page);
    expect(after.scale.x / after.baseScale.x).toBeCloseTo(2.5, 5);
    expect(after.scale.x).toBeGreaterThan(before.scale.x);
  });

  test("テキストの色を変更できる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Color", at(0.52, 0.5));
    await select(page, at(0.52, 0.5));

    await page.locator("#editColorPicker").fill("#ff0088");

    const [item] = await annotations(page);
    expect(item.color).toBe("#ff0088");
    // 色だけ変えてもテキストは保持されること
    expect(item.text).toBe("Color");
  });

  test("矢印の色を変更でき、回転もできる", async ({ page }) => {
    const at = await canvasMapper(page);
    const from = at(0.42, 0.6);
    const to = at(0.58, 0.42);
    await addArrow(page, from, to);
    // 矢印の軸は細いので、始点と終点のちょうど中間を狙って選択する
    await select(page, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });

    // 矢印はテキスト用の項目が隠れ、回転ボタンが使える
    await expect(page.locator("#textProperties")).toHaveClass(/hidden/);
    await expect(page.locator("#modeRotateBtn")).not.toHaveClass(/hidden/);

    await page.locator("#editColorPicker").fill("#00ff88");
    const [item] = await annotations(page);
    expect(item.color).toBe("#00ff88");

    // 実際にマテリアルへ反映されていること
    const meshColors = await page.evaluate(() => {
      const colors = [];
      window.__viewer.annotations[0].traverse((child) => {
        if (child.isMesh) colors.push("#" + child.material.color.getHexString());
      });
      return colors;
    });
    expect(meshColors.every(c => c === "#00ff88")).toBe(true);

    await page.locator("#modeRotateBtn").click();
    await expect(page.locator("#modeRotateBtn")).toHaveClass(/active/);
    expect(await page.evaluate(() => window.__viewer.transformControl.mode)).toBe("rotate");

    await page.locator("#modeTranslateBtn").click();
    expect(await page.evaluate(() => window.__viewer.transformControl.mode)).toBe("translate");
  });

  test("多角形の色と透過率を変更できる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addPolygon(page, [at(0.42, 0.42), at(0.6, 0.42), at(0.6, 0.6), at(0.42, 0.6)]);
    await select(page, at(0.52, 0.5));

    await expect(page.locator("#polygonProperties")).not.toHaveClass(/hidden/);
    await expect(page.locator("#editPolygonOpacity")).toHaveValue("0.5");

    await page.locator("#editColorPicker").fill("#ff8800");
    await page.locator("#editPolygonOpacity").fill("0.9");

    const [item] = await annotations(page);
    expect(item.color).toBe("#ff8800");
    expect(item.opacity).toBe(0.9);

    const materials = await page.evaluate(() => {
      const result = [];
      window.__viewer.annotations[0].traverse((child) => {
        if (child.material) {
          result.push({ color: "#" + child.material.color.getHexString(), opacity: child.material.opacity });
        }
      });
      return result;
    });
    expect(materials.every(m => m.color === "#ff8800")).toBe(true);
    expect(materials.filter(m => m.opacity === 0.9).length).toBeGreaterThan(0);
  });

  test("選択したアノテーションを TransformControls で掴める", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Move", at(0.52, 0.5));
    await select(page, at(0.52, 0.5));

    const attached = await page.evaluate(() => {
      const tc = window.__viewer.transformControl;
      return tc.object === window.__viewer.annotations[0];
    });
    expect(attached).toBe(true);
  });

  test("選択したアノテーションを削除できる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Keep", at(0.35, 0.4));
    await addText(page, "Delete", at(0.62, 0.6));
    expect(await annotations(page)).toHaveLength(2);

    await select(page, at(0.62, 0.6));
    await page.locator("#deleteObjectBtn").click();

    const remaining = await annotations(page);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe("Keep");
    await expect(page.locator("#propertyPanel")).toHaveClass(/hidden/);
  });

  test("閉じるボタンで選択を解除できる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Close", at(0.52, 0.5));
    await select(page, at(0.52, 0.5));

    await page.locator("#closePanelBtn").click();
    await expect(page.locator("#propertyPanel")).toHaveClass(/hidden/);
    expect(await page.evaluate(() => window.__viewer.selected)).toBeNull();
    // 削除はされていないこと
    expect(await annotations(page)).toHaveLength(1);
  });

  test("全消去ですべてのアノテーションが消える", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "A", at(0.35, 0.4));
    await addArrow(page, at(0.45, 0.6), at(0.6, 0.7));
    await addPolygon(page, [at(0.6, 0.35), at(0.72, 0.35), at(0.68, 0.45)]);
    expect(await annotations(page)).toHaveLength(3);

    await page.locator("#clearTextBtn").click();

    expect(await annotations(page)).toHaveLength(0);
    await expect(page.locator("#propertyPanel")).toHaveClass(/hidden/);

    // シーンからも取り除かれていること
    const leftovers = await page.evaluate(() => {
      let count = 0;
      window.__viewer.scene.traverse((obj) => {
        if (obj.userData && obj.userData.type) count++;
      });
      return count;
    });
    expect(leftovers).toBe(0);
  });

  test("別のファイルを読み込むとアノテーションはリセットされる", async ({ page }) => {
    const at = await canvasMapper(page);
    await addText(page, "Old", at(0.52, 0.5));
    expect(await annotations(page)).toHaveLength(1);

    await loadFixture(page, "panorama.jpg");
    expect(await annotations(page)).toHaveLength(0);
    expect(await page.evaluate(() => window.__viewer.mode)).toBe("none");
  });
});

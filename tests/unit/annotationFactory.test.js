import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  createArrowMesh,
  createPolygonMesh,
  updatePolygonProperties
} from "../../src/annotations/annotationFactory.js";

// createTextSprite / drawTextToCanvas は Canvas 2D を必要とするため、
// ここではなく tests/e2e/annotations.spec.js（実ブラウザ）で検証する。

describe("createArrowMesh", () => {
  const start = new THREE.Vector3(0, 0, -4);
  const end = new THREE.Vector3(0, 2, -4);

  it("矢印は shaft と head の 2 メッシュを持つ Group になる", () => {
    const arrow = createArrowMesh(start, end);
    expect(arrow).toBeInstanceOf(THREE.Group);
    expect(arrow.children).toHaveLength(2);
    expect(arrow.userData.type).toBe("arrow");
  });

  it("始点に配置され、終点方向を向く", () => {
    const arrow = createArrowMesh(start, end);
    expect(arrow.position.distanceTo(start)).toBeCloseTo(0, 6);

    // ローカル +Y が始点→終点方向に一致すること
    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion);
    const expected = end.clone().sub(start).normalize();
    expect(localUp.distanceTo(expected)).toBeCloseTo(0, 5);
  });

  it("長さが 0.1 未満なら null を返す（誤クリック対策）", () => {
    expect(createArrowMesh(start, start.clone().add(new THREE.Vector3(0, 0.05, 0)))).toBeNull();
    expect(createArrowMesh(start, start.clone())).toBeNull();
  });

  it("指定した色が全メッシュに反映される", () => {
    const arrow = createArrowMesh(start, end, "#123456");
    expect(arrow.userData.color).toBe("#123456");
    const expected = new THREE.Color("#123456");
    arrow.traverse((child) => {
      if (child.isMesh) {
        expect(child.material.color.getHexString()).toBe(expected.getHexString());
      }
    });
  });
});

describe("createPolygonMesh", () => {
  const square = [
    new THREE.Vector3(-1, -1, -4),
    new THREE.Vector3(1, -1, -4),
    new THREE.Vector3(1, 1, -4),
    new THREE.Vector3(-1, 1, -4)
  ];

  it("頂点が 3 未満なら null を返す", () => {
    expect(createPolygonMesh(square.slice(0, 2))).toBeNull();
    expect(createPolygonMesh([])).toBeNull();
  });

  it("面と輪郭線を持つ Group を返す", () => {
    const polygon = createPolygonMesh(square);
    expect(polygon).toBeInstanceOf(THREE.Group);
    expect(polygon.userData.type).toBe("polygon");
    expect(polygon.userData.vertexCount).toBe(4);
    expect(polygon.children.filter(c => c.isMesh)).toHaveLength(1);
    expect(polygon.children.filter(c => c.isLine)).toHaveLength(1);
  });

  it("重心が Group の原点になり、頂点は相対座標になる", () => {
    const polygon = createPolygonMesh(square);
    expect(polygon.position.x).toBeCloseTo(0, 6);
    expect(polygon.position.y).toBeCloseTo(0, 6);
    expect(polygon.position.z).toBeCloseTo(-4, 6);
  });

  it("fan triangulation で n-2 個の三角形を作る", () => {
    for (const n of [3, 4, 5, 6]) {
      const vertices = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a), Math.sin(a), -4);
      });
      const mesh = createPolygonMesh(vertices).children.find(c => c.isMesh);
      const positionCount = mesh.geometry.getAttribute("position").count;
      expect(positionCount).toBe((n - 2) * 3);
    }
  });

  it("輪郭線は最初の頂点に戻って閉じている", () => {
    const polygon = createPolygonMesh(square);
    const outline = polygon.children.find(c => c.isLine);
    const pos = outline.geometry.getAttribute("position");
    expect(pos.count).toBe(square.length + 1);
    expect(pos.getX(0)).toBeCloseTo(pos.getX(pos.count - 1), 6);
    expect(pos.getY(0)).toBeCloseTo(pos.getY(pos.count - 1), 6);
  });

  it("色と透過率を保持する", () => {
    const polygon = createPolygonMesh(square, "#00ff00", 0.3);
    expect(polygon.userData.color).toBe("#00ff00");
    expect(polygon.userData.opacity).toBe(0.3);
    const mesh = polygon.children.find(c => c.isMesh);
    expect(mesh.material.opacity).toBe(0.3);
    expect(mesh.material.transparent).toBe(true);
  });
});

describe("updatePolygonProperties", () => {
  const triangle = [
    new THREE.Vector3(0, 1, -4),
    new THREE.Vector3(1, -1, -4),
    new THREE.Vector3(-1, -1, -4)
  ];

  it("色と透過率が面と輪郭線の両方に伝播する", () => {
    const polygon = createPolygonMesh(triangle, "#00ff00", 0.5);
    updatePolygonProperties(polygon, "#ff8800", 0.9);

    expect(polygon.userData.color).toBe("#ff8800");
    expect(polygon.userData.opacity).toBe(0.9);

    const expected = new THREE.Color("#ff8800").getHexString();
    const mesh = polygon.children.find(c => c.isMesh);
    const outline = polygon.children.find(c => c.isLine);
    expect(mesh.material.color.getHexString()).toBe(expected);
    expect(mesh.material.opacity).toBe(0.9);
    expect(outline.material.color.getHexString()).toBe(expected);
  });

  it("polygon 以外には何もしない", () => {
    const arrow = createArrowMesh(new THREE.Vector3(0, 0, -4), new THREE.Vector3(0, 2, -4), "#ff0000");
    updatePolygonProperties(arrow, "#ffffff", 0.1);
    expect(arrow.userData.color).toBe("#ff0000");
  });
});

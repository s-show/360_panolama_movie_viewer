import * as THREE from "three";
import { drawTextToCanvas } from "../utils/canvasText.js";

export function createTextSprite(text, scale = 1.0, color = "#ffffff") {
  const { canvas } = drawTextToCanvas(text, color);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.userData = {
    type: "text",
    text: text,
    color: color,
    baseScale: new THREE.Vector3(canvas.width * 0.02, canvas.height * 0.02, 1)
  };

  mesh.scale.copy(mesh.userData.baseScale).multiplyScalar(scale);

  return mesh;
}

export function updateTextSpriteContent(sprite, newText, color) {
  if (sprite.userData.type !== "text") return;

  const fillColor = color || sprite.userData.color || "#ffffff";

  const { canvas } = drawTextToCanvas(newText, fillColor);

  const newTexture = new THREE.CanvasTexture(canvas);
  newTexture.colorSpace = THREE.SRGBColorSpace;

  sprite.material.map.dispose();
  sprite.material.map = newTexture;

  sprite.userData.text = newText;
  sprite.userData.color = fillColor;
  sprite.userData.baseScale.set(canvas.width * 0.02, canvas.height * 0.02, 1);

  const currentSizeSlider = document.getElementById("editTextSize");
  const userScale = parseFloat(currentSizeSlider.value) || 1.0;
  sprite.scale.copy(sprite.userData.baseScale).multiplyScalar(userScale);
}

export function createArrowMesh(start, end, color = "#ff0000") {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  if (length < 0.1) return null;

  const hex = new THREE.Color(color);
  const headLength = length * 0.2;
  const headWidth = Math.max(0.2, length * 0.05);
  const shaftWidth = headWidth * 0.4;

  const shaftLength = length - headLength;
  const shaftGeometry = new THREE.CylinderGeometry(shaftWidth, shaftWidth, shaftLength, 12, 1);
  const shaftMaterial = new THREE.MeshBasicMaterial({ color: hex });
  const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
  shaft.position.y = shaftLength / 2;

  const headGeometry = new THREE.ConeGeometry(headWidth, headLength, 12);
  const headMaterial = new THREE.MeshBasicMaterial({ color: hex });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = shaftLength + headLength / 2;

  const arrowGroup = new THREE.Group();
  arrowGroup.add(shaft);
  arrowGroup.add(head);
  arrowGroup.frustumCulled = false;
  shaft.frustumCulled = false;
  head.frustumCulled = false;
  arrowGroup.userData = { type: "arrow", color: color };

  arrowGroup.position.copy(start);

  const axis = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction.clone().normalize());
  arrowGroup.setRotationFromQuaternion(quaternion);

  return arrowGroup;
}


export function createPolygonMesh(vertices, color = "#00ff00", opacity = 0.5) {
  if (vertices.length < 3) return null;

  // 重心を計算（グループの原点として使用）
  const center = new THREE.Vector3();
  vertices.forEach(v => center.add(v));
  center.divideScalar(vertices.length);

  // 頂点を重心からの相対座標に変換
  const localVertices = vertices.map(v => v.clone().sub(center));

  // 三角形分割（fan triangulation）
  const positions = [];
  for (let i = 1; i < localVertices.length - 1; i++) {
    positions.push(
      localVertices[0].x, localVertices[0].y, localVertices[0].z,
      localVertices[i].x, localVertices[i].y, localVertices[i].z,
      localVertices[i + 1].x, localVertices[i + 1].y, localVertices[i + 1].z
    );
  }

  // 面のジオメトリ
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const threeColor = new THREE.Color(color);
  const material = new THREE.MeshBasicMaterial({
    color: threeColor,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;

  // 輪郭線
  const linePositions = [];
  localVertices.forEach(v => linePositions.push(v.x, v.y, v.z));
  // 閉じるために最初の頂点を追加
  linePositions.push(localVertices[0].x, localVertices[0].y, localVertices[0].z);

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));

  const lineMaterial = new THREE.LineBasicMaterial({
    color: threeColor,
    linewidth: 2
  });

  const outline = new THREE.Line(lineGeometry, lineMaterial);
  outline.frustumCulled = false;
  outline.renderOrder = 1;

  // グループ化
  const polygonGroup = new THREE.Group();
  polygonGroup.add(mesh);
  polygonGroup.add(outline);
  polygonGroup.position.copy(center);
  polygonGroup.frustumCulled = false;

  polygonGroup.userData = {
    type: "polygon",
    color: color,
    opacity: opacity,
    vertexCount: vertices.length
  };

  return polygonGroup;
}

export function updatePolygonProperties(polygonGroup, color, opacity) {
  if (polygonGroup.userData.type !== "polygon") return;

  const threeColor = new THREE.Color(color);

  polygonGroup.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.color.set(threeColor);
      child.material.opacity = opacity;
    }
    if (child.isLine && child.material) {
      child.material.color.set(threeColor);
    }
  });

  polygonGroup.userData.color = color;
  polygonGroup.userData.opacity = opacity;
}

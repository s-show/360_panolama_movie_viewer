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

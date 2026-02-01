import * as THREE from "three";
import { updateTextSpriteContent } from "../annotations/annotationFactory.js";
import * as annotationStore from "../annotations/annotationStore.js";
import * as editorState from "../state/editorState.js";

// DOM要素の取得
const toggleTextBtn = document.getElementById("toggleAddTextBtn");
const toggleArrowBtn = document.getElementById("toggleAddArrowBtn");
const propertyPanel = document.getElementById("propertyPanel");
const textProperties = document.getElementById("textProperties");
const editTextInput = document.getElementById("editTextInput");
const editTextLabel = document.getElementById("editTextLabel");
const editTextSizeLabel = document.getElementById("editTextSizeLabel");
const editTextSize = document.getElementById("editTextSize");
const editColorPicker = document.getElementById("editColorPicker");
const editColorLabel = document.getElementById("editColorLabel");
const deleteBtn = document.getElementById("deleteObjectBtn");
const closePanelBtn = document.getElementById("closePanelBtn");
const modeTranslateBtn = document.getElementById("modeTranslateBtn");
const modeRotateBtn = document.getElementById("modeRotateBtn");
const clearBtn = document.getElementById("clearTextBtn");

// viewer への参照（initUI で設定）
let viewerRef = null;

export function initUI(viewer) {
  viewerRef = viewer;
}

export function setMode(mode) {
  editorState.setCurrentMode(mode);

  if (toggleTextBtn) {
    toggleTextBtn.textContent = (mode === "text") ? "テキスト: ON" : "テキスト: OFF";
    toggleTextBtn.classList.toggle("active", mode === "text");
  }
  if (toggleArrowBtn) {
    toggleArrowBtn.textContent = (mode === "arrow") ? "矢印: ON" : "矢印: OFF";
    toggleArrowBtn.classList.toggle("active", mode === "arrow");
  }

  if (mode === "text") {
    document.body.style.cursor = "text";
  } else if (mode === "arrow") {
    document.body.style.cursor = "crosshair";
  } else {
    document.body.style.cursor = "default";
  }

  if (mode !== "none") {
    deselectObject();
  }

  editorState.setArrowStartPoint(null);
}

export function selectObject(obj) {
  if (editorState.selectedObject === obj) return;
  editorState.setSelectedObject(obj);

  if (viewerRef && viewerRef.transformControl) {
    viewerRef.transformControl.attach(obj);
  }

  propertyPanel.classList.remove("hidden");

  // Show color picker for all object types
  editColorLabel.classList.remove("hidden");
  editColorPicker.value = obj.userData.color || "#ffffff";

  if (obj.userData.type === "text") {
    textProperties.classList.remove("hidden");
    editTextLabel.classList.remove("hidden");
    editTextInput.classList.remove("hidden");
    editTextSizeLabel.classList.remove("hidden");
    editTextSize.classList.remove("hidden");
    modeRotateBtn.classList.add("hidden");
    if (viewerRef && viewerRef.transformControl) viewerRef.transformControl.setMode("translate");
    modeTranslateBtn.classList.add("active");
    modeRotateBtn.classList.remove("active");
    editTextInput.value = obj.userData.text;

    const currentScale = obj.scale.x / obj.userData.baseScale.x;
    editTextSize.value = currentScale.toFixed(1);
  } else {
    textProperties.classList.add("hidden");
    editTextLabel.classList.add("hidden");
    editTextInput.classList.add("hidden");
    editTextSizeLabel.classList.add("hidden");
    editTextSize.classList.add("hidden");
    modeRotateBtn.classList.remove("hidden");
  }
}

export function deselectObject() {
  editorState.setSelectedObject(null);
  if (viewerRef && viewerRef.transformControl) {
    viewerRef.transformControl.detach();
  }
  propertyPanel.classList.add("hidden");
}

// イベントリスナー登録
if (toggleTextBtn) toggleTextBtn.addEventListener("click", () => setMode(editorState.currentMode === "text" ? "none" : "text"));
if (toggleArrowBtn) toggleArrowBtn.addEventListener("click", () => setMode(editorState.currentMode === "arrow" ? "none" : "arrow"));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && editorState.currentMode !== "none") {
    setMode("none");
  }
});

if (closePanelBtn) closePanelBtn.addEventListener("click", deselectObject);

if (deleteBtn) {
  deleteBtn.addEventListener("click", () => {
    if (editorState.selectedObject && viewerRef) {
      viewerRef.removeObject(editorState.selectedObject);
      annotationStore.remove(editorState.selectedObject);

      if (editorState.selectedObject.material && editorState.selectedObject.material.map) {
        editorState.selectedObject.material.map.dispose();
      }

      deselectObject();
    }
  });
}

if (editTextInput) {
  editTextInput.addEventListener("input", (e) => {
    if (editorState.selectedObject && editorState.selectedObject.userData.type === "text") {
      updateTextSpriteContent(editorState.selectedObject, e.target.value);
    }
  });
}

if (editTextSize) {
  editTextSize.addEventListener("input", (e) => {
    if (editorState.selectedObject && editorState.selectedObject.userData.type === "text") {
      const val = parseFloat(e.target.value);
      editorState.selectedObject.scale.copy(editorState.selectedObject.userData.baseScale).multiplyScalar(val);
    }
  });
}

if (editColorPicker) {
  editColorPicker.addEventListener("input", (e) => {
    if (!editorState.selectedObject) return;
    const newColor = e.target.value;
    if (editorState.selectedObject.userData.type === "text") {
      updateTextSpriteContent(editorState.selectedObject, editorState.selectedObject.userData.text, newColor);
    } else if (editorState.selectedObject.userData.type === "arrow") {
      editorState.selectedObject.userData.color = newColor;
      const threeColor = new THREE.Color(newColor);
      editorState.selectedObject.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.color.set(threeColor);
        }
      });
    }
  });
}

if (modeTranslateBtn) {
  modeTranslateBtn.addEventListener("click", () => {
    if (viewerRef && viewerRef.transformControl) viewerRef.transformControl.setMode("translate");
    modeTranslateBtn.classList.add("active");
    modeRotateBtn.classList.remove("active");
  });
}

if (modeRotateBtn) {
  modeRotateBtn.addEventListener("click", () => {
    if (viewerRef && viewerRef.transformControl) viewerRef.transformControl.setMode("rotate");
    modeTranslateBtn.classList.remove("active");
    modeRotateBtn.classList.add("active");
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (!viewerRef) return;
    annotationStore.clear(viewerRef.scene);
    deselectObject();
  });
}

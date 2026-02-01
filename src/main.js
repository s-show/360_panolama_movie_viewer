import "./style.scss";
import * as THREE from "three";
import { createTextSprite, createArrowMesh } from "./annotations/annotationFactory.js";
import * as annotationStore from "./annotations/annotationStore.js";
import { detectFileType } from "./media/mediaDetector.js";
import { createTexture } from "./media/mediaLoader.js";
import { togglePlay } from "./media/videoControls.js";
import * as mediaState from "./state/mediaState.js";
import * as editorState from "./state/editorState.js";
import { Viewer } from "./viewer/Viewer.js";
import { saveEquirectangularImage } from "./exporter/equirectExporter.js";
import { initUI, setMode, selectObject, deselectObject } from "./ui/uiController.js";

// Viewer インスタンス
let viewer = null;

// UI で使用する DOM 要素
const textColorPicker = document.getElementById("textColorPicker");
const arrowColorPicker = document.getElementById("arrowColorPicker");

// ---------------------------------------------------------
// Scene Rendering
// ---------------------------------------------------------

async function renderScene(file, fileType) {
  annotationStore.reset();
  setMode("none");
  deselectObject();

  // Create or reinitialize viewer
  if (!viewer) {
    viewer = new Viewer();
  }

  // Prepare AbortController before creating texture (video controls need the signal)
  if (viewer.abortController) {
    viewer.abortController.abort();
  }
  viewer.abortController = new AbortController();

  const texture = createTexture(file, fileType, viewer.abortController.signal);
  const sceneSignal = viewer.init(texture);

  // Update UI controller's viewer reference
  initUI(viewer);

  // TransformControls dragging state
  viewer.transformControl.addEventListener("dragging-changed", function(event) {
    viewer.controls.enabled = !event.value;
    editorState.setDraggingGizmo(event.value);
  });

  // -------------------------------------------------------
  // Input Handling (Click & Drag)
  // -------------------------------------------------------

  const element = viewer.domElement;
  let mouseDownPos = new THREE.Vector2();
  let arrowPreview = null;

  element.addEventListener("mousedown", (event) => {
    mouseDownPos.set(event.clientX, event.clientY);

    if (editorState.isDraggingGizmo) return;

    if (editorState.currentMode === "none") return;

    viewer.controls.enabled = false;

    const point = viewer.getIntersectPoint(event);
    if (!point) return;

    if (editorState.currentMode === "arrow") {
      editorState.setArrowStartPoint(point.clone());

      // Create arrow preview
      const previewColor = arrowColorPicker ? new THREE.Color(arrowColorPicker.value) : new THREE.Color(0xff0000);
      arrowPreview = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        editorState.arrowStartPoint,
        0.1,
        previewColor,
        0.02,
        0.02
      );
      arrowPreview.visible = false;
      viewer.addObject(arrowPreview);
    }
  });

  element.addEventListener("mousemove", (event) => {
    if (editorState.currentMode !== "arrow" || !editorState.arrowStartPoint || !arrowPreview) return;

    const point = viewer.getIntersectPoint(event);
    if (!point) return;

    const direction = new THREE.Vector3().subVectors(point, editorState.arrowStartPoint);
    const length = direction.length();
    if (length < 0.1) {
      arrowPreview.visible = false;
      return;
    }

    arrowPreview.visible = true;
    arrowPreview.position.copy(editorState.arrowStartPoint);
    arrowPreview.setDirection(direction.normalize());
    arrowPreview.setLength(length, length * 0.2, Math.max(0.2, length * 0.05));
  });

  element.addEventListener("mouseup", (event) => {
    viewer.controls.enabled = true;

    // Remove arrow preview
    if (arrowPreview) {
      viewer.removeObject(arrowPreview);
      arrowPreview.dispose();
      arrowPreview = null;
    }

    if (editorState.isDraggingGizmo) return;

    const dist = new THREE.Vector2(event.clientX, event.clientY).distanceTo(mouseDownPos);
    const isClick = dist < 5;

    // 1. 書き込みモード時の処理
    if (editorState.currentMode !== "none") {
      if (!isClick && editorState.currentMode !== "arrow") return;

      const point = viewer.getIntersectPoint(event);
      if (!point) return;

      if (editorState.currentMode === "text" && isClick) {
        const textInput = document.getElementById("labelTextInput");
        const text = textInput.value.trim();
        if (!text) {
          alert("ラベルテキストを入力してください");
          return;
        }
        const textColor = textColorPicker ? textColorPicker.value : "#ffffff";
        const sprite = createTextSprite(text, 1.0, textColor);
        sprite.position.copy(point).multiplyScalar(0.9);
        sprite.lookAt(0, 0, 0);
        viewer.addObject(sprite);
        annotationStore.add(sprite);
      } else if (editorState.currentMode === "arrow" && editorState.arrowStartPoint) {
        const arrowColor = arrowColorPicker ? arrowColorPicker.value : "#ff0000";
        const arrowGroup = createArrowMesh(editorState.arrowStartPoint, point, arrowColor);
        if (arrowGroup) {
          viewer.addObject(arrowGroup);
          annotationStore.add(arrowGroup);
        }
        editorState.setArrowStartPoint(null);
      }
      return;
    }

    // 2. 編集（選択）モード時の処理
    if (isClick) {
      const clickedObj = viewer.checkIntersection(event, annotationStore.getAll());
      if (clickedObj) {
        selectObject(clickedObj);
      } else {
        deselectObject();
        // 動画再生中はクリックで再生/停止を切り替え
        if (mediaState.get()) {
          togglePlay(mediaState.get());
        }
      }
    }
  });

  // -------------------------------------------------------
  // Equirectangular Image Save
  // -------------------------------------------------------
  const saveEquirectBtn = document.getElementById("saveEquirectBtn");
  if (saveEquirectBtn) {
    saveEquirectBtn.addEventListener("click", () => {
      saveEquirectangularImage(viewer.renderer, viewer.scene, viewer.transformControl);
    }, { signal: sceneSignal });
  }
}

// ---------------------------------------------------------
// File Selection
// ---------------------------------------------------------

document.getElementById("fileSelector").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const fileType = await detectFileType(file);
  if (fileType === "unknown") {
    alert("画像または動画ファイルを選択してください");
    return;
  }
  const canvasDom = document.querySelector("canvas");
  if (canvasDom != null) {
    canvasDom.parentNode.removeChild(canvasDom);
  }
  renderScene(file, fileType);
  event.target.blur();
});

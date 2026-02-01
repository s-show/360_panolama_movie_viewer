// エディタの状態を集約管理するモジュール

export let currentMode = "none"; // 'none', 'text', 'arrow'
export let selectedObject = null;
export let isDraggingGizmo = false;
export let arrowStartPoint = null;

export function setCurrentMode(mode) {
  currentMode = mode;
}

export function setSelectedObject(obj) {
  selectedObject = obj;
}

export function setDraggingGizmo(value) {
  isDraggingGizmo = value;
}

export function setArrowStartPoint(point) {
  arrowStartPoint = point;
}

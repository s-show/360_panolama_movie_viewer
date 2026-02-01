let drawnObjects = [];

export function add(obj) {
  drawnObjects.push(obj);
}

export function remove(obj) {
  drawnObjects = drawnObjects.filter(o => o !== obj);
}

export function clear(scene) {
  drawnObjects.forEach(obj => scene.remove(obj));
  drawnObjects = [];
}

export function getAll() {
  return drawnObjects;
}

export function reset() {
  drawnObjects = [];
}

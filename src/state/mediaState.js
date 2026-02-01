let currentVideo = null;

export function get() {
  return currentVideo;
}

export function set(video) {
  currentVideo = video;
}

export function clear() {
  currentVideo = null;
}

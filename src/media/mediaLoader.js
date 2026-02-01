import * as THREE from "three";
import { pauseIcon } from "../ui/icons.js";
import * as mediaState from "../state/mediaState.js";
import { addVideoControls } from "./videoControls.js";

export function createTexture(source, mediaType, signal) {
  const textToolControls = document.getElementById("textToolControls");
  const saveImageDiv = document.getElementById("saveImageDiv");
  let texture;

  if (mediaType === "image") {
    texture = new THREE.TextureLoader().load(URL.createObjectURL(source));
    mediaState.clear();
    document.querySelector(".controls-container").classList.add("hidden");
    textToolControls.classList.remove("hidden");
    saveImageDiv.classList.remove("hidden");
  } else if (mediaType === "video") {
    textToolControls.classList.add("hidden");
    saveImageDiv.classList.add("hidden");
    const videoUrl = URL.createObjectURL(source);
    const video = document.createElement("video");
    video.src = videoUrl;
    video.autoplay = true;
    video.loop = false;
    video.playsInline = true;
    video.muted = true;
    video.addEventListener("ended", () => { video.currentTime = 0; });
    video.play();
    const playPauseBtn = document.getElementById("playPauseBtn");
    if (playPauseBtn) playPauseBtn.innerHTML = pauseIcon;
    document.querySelector(".controls-container").classList.remove("hidden");
    texture = new THREE.VideoTexture(video);
    mediaState.set(video);
    addVideoControls(video, signal);
  } else {
    console.error("未対応のファイル形式が選択されました。");
    return null;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

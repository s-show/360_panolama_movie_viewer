import { playIcon, pauseIcon } from "../ui/icons.js";
import { clamp } from "../utils/math.js";

export function addVideoControls(video, signal) {
  const playPauseBtn = document.getElementById("playPauseBtn");
  playPauseBtn.addEventListener("click", () => togglePlay(video), { signal });
  const rewindBtn = document.getElementById("rewindBtn");
  rewindBtn.addEventListener("click", () => adjustTime(video, -10), { signal });
  const forwardBtn = document.getElementById("fastForwardBtn");
  forwardBtn.addEventListener("click", () => adjustTime(video, 10), { signal });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      togglePlay(video);
    } else if (e.code === "ArrowLeft") {
      adjustTime(video, -10);
    } else if (e.code === "ArrowRight") {
      adjustTime(video, 10);
    }
  });
}

export function togglePlay(video) {
  const playPauseBtn = document.getElementById("playPauseBtn");
  if (video.paused) {
    video.play();
    playPauseBtn.innerHTML = pauseIcon;
  } else {
    video.pause();
    playPauseBtn.innerHTML = playIcon;
  }
}

export function adjustTime(video, deltaTime) {
  const newTime = video.currentTime + deltaTime;
  video.currentTime = clamp(newTime, 0, video.duration);
}

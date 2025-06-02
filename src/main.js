import './style.scss'
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const SIGNATURES = {
  // 形式判定用ユーティリティ
  isImage: buf =>
    SIGNATURES.isJPEG(buf) || SIGNATURES.isPNG(buf) ||
    SIGNATURES.isGIF(buf) || SIGNATURES.isBMP(buf),
  isJPEG: buf => buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF,
  isPNG: buf => buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47,
  isGIF: buf => buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46,
  isBMP: buf => buf[0] === 0x42 && buf[1] === 0x4D,
  isVideo: buf =>
    SIGNATURES.isMP4(buf) || SIGNATURES.isWebM(buf) || SIGNATURES.isFLV(buf),
  isMP4: buf => buf.length >= 8
    && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70,
  isWebM: buf => buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3,
  isFLV: buf => buf[0] === 0x46 && buf[1] === 0x4C && buf[2] === 0x56
  // 必要に応じて他の形式を追加
};

async function detectFileType(file) {
  const blob = file.slice(0, 12);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return SIGNATURES.isImage(bytes) ? 'image' : SIGNATURES.isVideo(bytes) ? 'video' : 'unknown';
}

function createTexture(source, mediaType) {
  let texture;
  if (mediaType === 'image') {
    texture = new THREE.TextureLoader().load(URL.createObjectURL(source));
    document.querySelector('.controls-container').classList.add('hidden');
  } else if (mediaType === 'video') {
    const videoUrl = URL.createObjectURL(source);
    const video = document.createElement("video");
    video.src = videoUrl;
    video.autoplay = true;
    video.loop = false;
    video.playsInline = true;
    video.muted = true;
    video.addEventListener('ended', () => {
      video.currentTime = 0;
    })
    video.play();
    document.querySelector('.controls-container').classList.remove('hidden');
    texture = new THREE.VideoTexture(video);
    addVideoControls(video);
  } else {
    console.error('未対応のファイル形式が選択されました。');
    return null;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addVideoControls(video) {
  const playBtn = document.getElementById('playPauseBtn');
  playBtn.addEventListener('click', () => togglePlay(video));
  const rewindBtn = document.getElementById('rewindBtn');
  rewindBtn.addEventListener('click', () => adjustTime(video, -10));
  const forwardBtn = document.getElementById('fastForwardBtn');
  forwardBtn.addEventListener('click', () => adjustTime(video, 10));
}

function togglePlay(video) {
  // 再生アイコンと一時停止アイコンのSVG文字列
  const playIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const pauseIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

  if (video.paused) {
    video.play();
    playPauseBtn.innerHTML = playIcon;
  } else {
    video.pause();
    playPauseBtn.innerHTML = pauseIcon;
  }
}

function adjustTime(video, deltaTime) {
  const newTime = video.currentTime + deltaTime;
  video.currentTime = Math.clamp(newTime, 0, video.duration);
}

Math.clamp = function(num, min, max) {
  return num <= min ? min : num >= max ? max : num
};

document.getElementById('fileSelector').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const fileType = await detectFileType(file);
  if (fileType === 'unknown') {
    alert('画像または動画ファイルを選択してください')
    return;
  }
  const canvasDom = document.querySelector('canvas');
  // 既存の canvas 要素を削除しないと2回目以降に読み込んだファイルが表示されない
  if (canvasDom != null) {
    canvasDom.parentNode.removeChild(canvasDom);
  }
  renderScene(file, fileType);
});

async function renderScene(file, fileType) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 1, 1000);
  camera.position.set(0, 0, 0);
  scene.add(camera);

  const geometry = new THREE.SphereGeometry(5, 60, 40);
  geometry.scale(-1, 1, 1);

  const material = new THREE.MeshBasicMaterial({
    map: createTexture(file, fileType),
  });

  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  const renderer = new THREE.WebGLRenderer();
  renderer.setClearColor({ color: 0x000000 });
  const element = renderer.domElement;
  document.body.append(element);
  renderer.render(scene, camera);

  const controls = new OrbitControls(camera, element);
  controls.target.set(camera.position.x + 0.15, camera.position.y, camera.position.z);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.5;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.panSpeed = 6;
  controls.listenToKeyEvents(window);
  controls.keyPanSpeed = 35.0;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  }
  let controlsState = controls.saveState();

  window.addEventListener("resize", handleResize);
  handleResize();
  tick();

  function handleResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  function tick() {
    requestAnimationFrame(tick);
    renderer.render(scene, camera);
    controls.update();
  }

  addEventListener('wheel', event => camera.zoom = event.deltaY * -2);
  document.getElementById('controlResetBtn').addEventListener('click', () => {
    controls.reset();
    controlsState = controls.saveState();
  });
}


import './style.scss'
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// 再生アイコンと一時停止アイコンのSVG文字列
const playIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const pauseIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

// 編集モードの状態管理
let currentMode = 'none'; // 'none', 'text', 'arrow'
let currentScene = null;
let drawnObjects = [];

// 選択・編集用
let transformControl = null;
let selectedObject = null;
let isDraggingGizmo = false; // ギズモ操作中フラグ

// 矢印描画用の一時変数
let arrowStartPoint = null;

// 現在再生中の動画要素
let currentVideo = null;

// renderScene内で登録するイベントリスナーを一括解除するためのAbortController
let sceneAbortController = null;

const SIGNATURES = {
  isImage: buf => SIGNATURES.isJPEG(buf) || SIGNATURES.isPNG(buf) || SIGNATURES.isGIF(buf) || SIGNATURES.isBMP(buf),
  isJPEG: buf => buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF,
  isPNG: buf => buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47,
  isGIF: buf => buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46,
  isBMP: buf => buf[0] === 0x42 && buf[1] === 0x4D,
  isVideo: buf => SIGNATURES.isMP4(buf) || SIGNATURES.isWebM(buf) || SIGNATURES.isFLV(buf),
  isMP4: buf => buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70,
  isWebM: buf => buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3,
  isFLV: buf => buf[0] === 0x46 && buf[1] === 0x4C && buf[2] === 0x56
};

// ---------------------------------------------------------
// Helper Functions for 3D Objects
// ---------------------------------------------------------

function createTextSprite(text, scale = 1.0, color = "#ffffff") {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 64;
  const strokeWidth = 4;
  const padding = 20;
  const margin = strokeWidth / 2 + padding;
  context.font = `bold ${fontSize}px Arial, sans-serif`;

  const metrics = context.measureText(text);
  const bboxLeft = metrics.actualBoundingBoxLeft;
  const bboxRight = metrics.actualBoundingBoxRight;
  const bboxAscent = metrics.actualBoundingBoxAscent;
  const bboxDescent = metrics.actualBoundingBoxDescent;

  canvas.width = bboxLeft + bboxRight + margin * 2;
  canvas.height = bboxAscent + bboxDescent + margin * 2;

  context.font = `bold ${fontSize}px Arial, sans-serif`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';

  const drawX = margin + bboxLeft;
  const drawY = margin + bboxAscent;

  context.lineWidth = strokeWidth;
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  context.strokeText(text, drawX, drawY);

  context.fillStyle = color;
  context.fillText(text, drawX, drawY);

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
    type: 'text',
    text: text,
    color: color,
    baseScale: new THREE.Vector3(canvas.width * 0.02, canvas.height * 0.02, 1)
  };

  mesh.scale.copy(mesh.userData.baseScale).multiplyScalar(scale);

  return mesh;
}

function updateTextSpriteContent(sprite, newText, color) {
  if (sprite.userData.type !== 'text') return;

  const fillColor = color || sprite.userData.color || "#ffffff";

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 64;
  const strokeWidth = 4;
  const padding = 20;
  const margin = strokeWidth / 2 + padding;
  context.font = `bold ${fontSize}px Arial, sans-serif`;

  const metrics = context.measureText(newText);
  const bboxLeft = metrics.actualBoundingBoxLeft;
  const bboxRight = metrics.actualBoundingBoxRight;
  const bboxAscent = metrics.actualBoundingBoxAscent;
  const bboxDescent = metrics.actualBoundingBoxDescent;

  canvas.width = bboxLeft + bboxRight + margin * 2;
  canvas.height = bboxAscent + bboxDescent + margin * 2;

  context.font = `bold ${fontSize}px Arial, sans-serif`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';

  const drawX = margin + bboxLeft;
  const drawY = margin + bboxAscent;

  context.lineWidth = strokeWidth;
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  context.strokeText(newText, drawX, drawY);

  context.fillStyle = fillColor;
  context.fillText(newText, drawX, drawY);

  const newTexture = new THREE.CanvasTexture(canvas);
  newTexture.colorSpace = THREE.SRGBColorSpace;

  sprite.material.map.dispose();
  sprite.material.map = newTexture;

  sprite.userData.text = newText;
  sprite.userData.color = fillColor;
  sprite.userData.baseScale.set(canvas.width * 0.02, canvas.height * 0.02, 1);

  const currentSizeSlider = document.getElementById('editTextSize');
  const userScale = parseFloat(currentSizeSlider.value) || 1.0;
  sprite.scale.copy(sprite.userData.baseScale).multiplyScalar(userScale);
}


function createArrowMesh(start, end, color = "#ff0000") {
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
  arrowGroup.userData = { type: 'arrow', color: color };

  arrowGroup.position.copy(start);

  const axis = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction.clone().normalize());
  arrowGroup.setRotationFromQuaternion(quaternion);

  return arrowGroup;
}

// ---------------------------------------------------------
// UI Event Listeners
// ---------------------------------------------------------

const toggleTextBtn = document.getElementById('toggleAddTextBtn');
const toggleArrowBtn = document.getElementById('toggleAddArrowBtn');

const propertyPanel = document.getElementById('propertyPanel');
const textToolControls = document.getElementById('textToolControls');
const textProperties = document.getElementById('textProperties');
const editTextInput = document.getElementById('editTextInput');
const editTextLabel = document.getElementById('editTextLabel');
const editTextSizeLabel = document.getElementById('editTextSizeLabel');
const editTextSize = document.getElementById('editTextSize');
const editColorPicker = document.getElementById('editColorPicker');
const editColorLabel = document.getElementById('editColorLabel');
const textColorPicker = document.getElementById('textColorPicker');
const arrowColorPicker = document.getElementById('arrowColorPicker');
const saveImageDiv = document.getElementById('saveImageDiv');
const deleteBtn = document.getElementById('deleteObjectBtn');
const closePanelBtn = document.getElementById('closePanelBtn');
const modeTranslateBtn = document.getElementById('modeTranslateBtn');
const modeRotateBtn = document.getElementById('modeRotateBtn');

function setMode(mode) {
  currentMode = mode;

  if (toggleTextBtn) {
    toggleTextBtn.textContent = (mode === 'text') ? 'テキスト: ON' : 'テキスト: OFF';
    toggleTextBtn.classList.toggle('active', mode === 'text');
  }
  if (toggleArrowBtn) {
    toggleArrowBtn.textContent = (mode === 'arrow') ? '矢印: ON' : '矢印: OFF';
    toggleArrowBtn.classList.toggle('active', mode === 'arrow');
  }

  if (mode === 'text') {
    document.body.style.cursor = 'text';
  } else if (mode === 'arrow') {
    document.body.style.cursor = 'crosshair';
  } else {
    document.body.style.cursor = 'default';
  }

  if (mode !== 'none') {
    deselectObject();
  }

  arrowStartPoint = null;
}

function selectObject(obj) {
  if (selectedObject === obj) return;
  selectedObject = obj;

  if (transformControl) {
    transformControl.attach(obj);
  }

  propertyPanel.classList.remove('hidden');

  // Show color picker for all object types
  editColorLabel.classList.remove('hidden');
  editColorPicker.value = obj.userData.color || "#ffffff";

  if (obj.userData.type === 'text') {
    textProperties.classList.remove('hidden');
    editTextLabel.classList.remove('hidden');
    editTextInput.classList.remove('hidden');
    editTextSizeLabel.classList.remove('hidden');
    editTextSize.classList.remove('hidden');
    modeRotateBtn.classList.add('hidden');
    if (transformControl) transformControl.setMode('translate');
    modeTranslateBtn.classList.add('active');
    modeRotateBtn.classList.remove('active');
    editTextInput.value = obj.userData.text;

    const currentScale = obj.scale.x / obj.userData.baseScale.x;
    editTextSize.value = currentScale.toFixed(1);
  } else {
    textProperties.classList.add('hidden');
    editTextLabel.classList.add('hidden');
    editTextInput.classList.add('hidden');
    editTextSizeLabel.classList.add('hidden');
    editTextSize.classList.add('hidden');
    modeRotateBtn.classList.remove('hidden');
  }
}

function deselectObject() {
  selectedObject = null;
  if (transformControl) {
    transformControl.detach();
  }
  propertyPanel.classList.add('hidden');
}

if (toggleTextBtn) toggleTextBtn.addEventListener('click', () => setMode(currentMode === 'text' ? 'none' : 'text'));
if (toggleArrowBtn) toggleArrowBtn.addEventListener('click', () => setMode(currentMode === 'arrow' ? 'none' : 'arrow'));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentMode !== 'none') {
    setMode('none');
  }
});

if (closePanelBtn) closePanelBtn.addEventListener('click', deselectObject);

if (deleteBtn) {
  deleteBtn.addEventListener('click', () => {
    if (selectedObject && currentScene) {
      currentScene.remove(selectedObject);
      drawnObjects = drawnObjects.filter(o => o !== selectedObject);

      if (selectedObject.material && selectedObject.material.map) selectedObject.material.map.dispose();

      deselectObject();
    }
  });
}

if (editTextInput) {
  editTextInput.addEventListener('input', (e) => {
    if (selectedObject && selectedObject.userData.type === 'text') {
      updateTextSpriteContent(selectedObject, e.target.value);
    }
  });
}

if (editTextSize) {
  editTextSize.addEventListener('input', (e) => {
    if (selectedObject && selectedObject.userData.type === 'text') {
      const val = parseFloat(e.target.value);
      selectedObject.scale.copy(selectedObject.userData.baseScale).multiplyScalar(val);
    }
  });
}

if (editColorPicker) {
  editColorPicker.addEventListener('input', (e) => {
    if (!selectedObject) return;
    const newColor = e.target.value;
    if (selectedObject.userData.type === 'text') {
      updateTextSpriteContent(selectedObject, selectedObject.userData.text, newColor);
    } else if (selectedObject.userData.type === 'arrow') {
      selectedObject.userData.color = newColor;
      const threeColor = new THREE.Color(newColor);
      selectedObject.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.color.set(threeColor);
        }
      });
    }
  });
}

if (modeTranslateBtn) {
  modeTranslateBtn.addEventListener('click', () => {
    if (transformControl) transformControl.setMode('translate');
    modeTranslateBtn.classList.add('active');
    modeRotateBtn.classList.remove('active');
  });
}

if (modeRotateBtn) {
  modeRotateBtn.addEventListener('click', () => {
    if (transformControl) transformControl.setMode('rotate');
    modeTranslateBtn.classList.remove('active');
    modeRotateBtn.classList.add('active');
  });
}

const clearBtn = document.getElementById('clearTextBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (!currentScene) return;
    drawnObjects.forEach(obj => currentScene.remove(obj));
    drawnObjects = [];
    deselectObject();
  });
}

// ---------------------------------------------------------
// Main Rendering Logic
// ---------------------------------------------------------

async function detectFileType(file) {
  const blob = file.slice(0, 12);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return SIGNATURES.isImage(bytes) ? 'image' : SIGNATURES.isVideo(bytes) ? 'video' : 'unknown';
}

function createTexture(source, mediaType, signal) {
  let texture;
  if (mediaType === 'image') {
    texture = new THREE.TextureLoader().load(URL.createObjectURL(source));
    currentVideo = null;
    document.querySelector('.controls-container').classList.add('hidden');
    textToolControls.classList.remove('hidden');
    saveImageDiv.classList.remove('hidden')
  } else if (mediaType === 'video') {
    textToolControls.classList.add('hidden');
    saveImageDiv.classList.add('hidden')
    const videoUrl = URL.createObjectURL(source);
    const video = document.createElement("video");
    video.src = videoUrl;
    video.autoplay = true;
    video.loop = false;
    video.playsInline = true;
    video.muted = true;
    video.addEventListener('ended', () => { video.currentTime = 0; })
    video.play();
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (playPauseBtn) playPauseBtn.innerHTML = pauseIcon;
    document.querySelector('.controls-container').classList.remove('hidden');
    texture = new THREE.VideoTexture(video);
    currentVideo = video;
    addVideoControls(video, signal);
  } else {
    console.error('未対応のファイル形式が選択されました。');
    return null;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addVideoControls(video, signal) {
  const playPauseBtn = document.getElementById('playPauseBtn');
  playPauseBtn.addEventListener('click', () => togglePlay(video), { signal });
  const rewindBtn = document.getElementById('rewindBtn');
  rewindBtn.addEventListener('click', () => adjustTime(video, -10), { signal });
  const forwardBtn = document.getElementById('fastForwardBtn');
  forwardBtn.addEventListener('click', () => adjustTime(video, 10), { signal });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      togglePlay(video);
    } else if (e.code === 'ArrowLeft') {
      adjustTime(video, -10)
    } else if (e.code === 'ArrowRight') {
      adjustTime(video, 10)
    }
  });
}

function togglePlay(video) {
  const playPauseBtn = document.getElementById('playPauseBtn');
  if (video.paused) {
    video.play();
    playPauseBtn.innerHTML = pauseIcon;
  } else {
    video.pause();
    playPauseBtn.innerHTML = playIcon;
  }
}

function adjustTime(video, deltaTime) {
  const newTime = video.currentTime + deltaTime;
  video.currentTime = Math.clamp(newTime, 0, video.duration);
}

Math.clamp = function(num, min, max) {
  return num <= min ? min : num >= max ? max : num
};

// ---------------------------------------------------------
// Equirectangular Save
// ---------------------------------------------------------

const equirectVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const equirectFragmentShader = /* glsl */ `
uniform samplerCube cubeMap;
varying vec2 vUv;
#define PI 3.14159265359
void main() {
  float theta = PI - vUv.x * 2.0 * PI;
  float phi = vUv.y * PI;
  vec3 dir = vec3(
    sin(phi) * sin(theta),
    cos(phi),
    sin(phi) * cos(theta)
  );
  gl_FragColor = textureCube(cubeMap, dir);
}
`;

function saveEquirectangularImage(mainRenderer, scene) {
  // Hide TransformControls helper during capture
  const tcHelper = transformControl ? transformControl.getHelper() : null;
  let tcWasVisible = false;
  if (tcHelper) {
    tcWasVisible = tcHelper.visible;
    tcHelper.visible = false;
  }

  // Determine output resolution from the panorama source
  let outputWidth = 4096;
  let outputHeight = 2048;
  scene.traverse((child) => {
    if (child.isMesh && child.material && child.material.map && !child.userData.type) {
      const img = child.material.map.image;
      if (img) {
        const w = img.videoWidth || img.naturalWidth || img.width;
        const h = img.videoHeight || img.naturalHeight || img.height;
        if (w && h) {
          outputWidth = w;
          outputHeight = h;
        }
      }
    }
  });

  const cubeSize = Math.min(Math.max(outputWidth / 2, 2048), 4096);
  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(cubeSize);
  const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
  cubeCamera.position.set(0, 0, 0);

  cubeCamera.update(mainRenderer, scene);

  // Render equirectangular conversion on the main renderer into an offscreen target
  // Use SRGBColorSpace so the renderer applies linear→sRGB conversion on write
  const equirectTarget = new THREE.WebGLRenderTarget(outputWidth, outputHeight);
  equirectTarget.texture.colorSpace = THREE.SRGBColorSpace;

  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quadMaterial = new THREE.ShaderMaterial({
    uniforms: {
      cubeMap: { value: cubeRenderTarget.texture }
    },
    vertexShader: equirectVertexShader,
    fragmentShader: equirectFragmentShader,
    depthTest: false,
    depthWrite: false
  });
  const quadMesh = new THREE.Mesh(quadGeometry, quadMaterial);
  quadScene.add(quadMesh);

  mainRenderer.setRenderTarget(equirectTarget);
  mainRenderer.render(quadScene, quadCamera);
  mainRenderer.setRenderTarget(null);

  // Read pixels from the render target
  const pixels = new Uint8Array(outputWidth * outputHeight * 4);
  mainRenderer.readRenderTargetPixels(equirectTarget, 0, 0, outputWidth, outputHeight, pixels);

  // Write pixels to a 2D canvas
  const canvas2d = document.createElement("canvas");
  canvas2d.width = outputWidth;
  canvas2d.height = outputHeight;
  const ctx = canvas2d.getContext("2d");
  const imageData = ctx.createImageData(outputWidth, outputHeight);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);

  // Download
  const format = document.getElementById("saveFormatSelect").value;
  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const ext = format === "jpeg" ? "jpg" : "png";
  const dataURL = canvas2d.toDataURL(mimeType, 0.92);
  const link = document.createElement("a");
  link.download = `equirectangular.${ext}`;
  link.href = dataURL;
  link.click();

  // Cleanup
  quadGeometry.dispose();
  quadMaterial.dispose();
  equirectTarget.dispose();
  cubeRenderTarget.dispose();

  // Restore TransformControls helper
  if (tcHelper) {
    tcHelper.visible = tcWasVisible;
  }
}

async function renderScene(file, fileType) {
  // 前回のrenderSceneで登録したイベントリスナーを一括解除
  if (sceneAbortController) {
    sceneAbortController.abort();
  }
  sceneAbortController = new AbortController();
  const sceneSignal = sceneAbortController.signal;

  const scene = new THREE.Scene();
  currentScene = scene;
  drawnObjects = [];
  setMode('none');
  deselectObject();

  // Cleanup previous controls if needed
  if (transformControl) {
    transformControl.dispose();
    transformControl = null;
  }

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 1, 1000);
  camera.position.set(0, 0, 0);
  scene.add(camera);

  const geometry = new THREE.SphereGeometry(5, 60, 40);
  geometry.scale(-1, 1, 1);

  const material = new THREE.MeshBasicMaterial({
    map: createTexture(file, fileType, sceneSignal),
    side: THREE.DoubleSide
  });

  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  const renderer = new THREE.WebGLRenderer();
  renderer.setClearColor({ color: 0x000000 });
  const element = renderer.domElement;
  element.style.display = 'block';
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

  // -------------------------------------------------------
  // Transform Controls Setup
  // -------------------------------------------------------
  transformControl = new TransformControls(camera, renderer.domElement);

  transformControl.addEventListener('dragging-changed', function(event) {
    controls.enabled = !event.value;
    isDraggingGizmo = event.value;
  });

  scene.add(transformControl.getHelper());

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function getIntersectPoint(event) {
    const rect = element.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphere);
    return intersects.length > 0 ? intersects[0].point : null;
  }

  function checkIntersection(event) {
    const rect = element.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(drawnObjects, true);

    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target.parent && target.parent !== scene) {
        target = target.parent;
      }
      return target;
    }
    return null;
  }

  // -------------------------------------------------------
  // Input Handling (Click & Drag)
  // -------------------------------------------------------

  let mouseDownPos = new THREE.Vector2();

  element.addEventListener('mousedown', (event) => {
    mouseDownPos.set(event.clientX, event.clientY);

    if (isDraggingGizmo) return;

    if (currentMode === 'none') return;

    controls.enabled = false;

    const point = getIntersectPoint(event);
    if (!point) return;

    if (currentMode === 'arrow') {
      arrowStartPoint = point.clone();

      // Create arrow preview
      const previewColor = arrowColorPicker ? new THREE.Color(arrowColorPicker.value) : new THREE.Color(0xff0000);
      arrowPreview = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        arrowStartPoint,
        0.1,
        previewColor,
        0.02,
        0.02
      );
      arrowPreview.visible = false;
      scene.add(arrowPreview);
    }
  });

  let arrowPreview = null;

  element.addEventListener('mousemove', (event) => {
    if (currentMode !== 'arrow' || !arrowStartPoint || !arrowPreview) return;

    const point = getIntersectPoint(event);
    if (!point) return;

    const direction = new THREE.Vector3().subVectors(point, arrowStartPoint);
    const length = direction.length();
    if (length < 0.1) {
      arrowPreview.visible = false;
      return;
    }

    arrowPreview.visible = true;
    arrowPreview.position.copy(arrowStartPoint);
    arrowPreview.setDirection(direction.normalize());
    arrowPreview.setLength(length, length * 0.2, Math.max(0.2, length * 0.05));
  });

  element.addEventListener('mouseup', (event) => {
    controls.enabled = true;

    // Remove arrow preview
    if (arrowPreview) {
      scene.remove(arrowPreview);
      arrowPreview.dispose();
      arrowPreview = null;
    }

    if (isDraggingGizmo) return;

    const dist = new THREE.Vector2(event.clientX, event.clientY).distanceTo(mouseDownPos);
    const isClick = dist < 5;

    // 1. 書き込みモード時の処理
    if (currentMode !== 'none') {
      if (!isClick && currentMode !== 'arrow') return;

      const point = getIntersectPoint(event);
      if (!point) return;

      if (currentMode === 'text' && isClick) {
        const textInput = document.getElementById('labelTextInput');
        const text = textInput.value.trim();
        if (!text) {
          alert('ラベルテキストを入力してください');
          return;
        }
        const textColor = textColorPicker ? textColorPicker.value : "#ffffff";
        const sprite = createTextSprite(text, 1.0, textColor);
        sprite.position.copy(point).multiplyScalar(0.9);
        sprite.lookAt(0, 0, 0);
        scene.add(sprite);
        drawnObjects.push(sprite);
      } else if (currentMode === 'arrow' && arrowStartPoint) {
        const arrowColor = arrowColorPicker ? arrowColorPicker.value : "#ff0000";
        const arrowGroup = createArrowMesh(arrowStartPoint, point, arrowColor);
        if (arrowGroup) {
          scene.add(arrowGroup);
          drawnObjects.push(arrowGroup);
        }
        arrowStartPoint = null;
      }
      return;
    }

    // 2. 編集（選択）モード時の処理
    if (isClick) {
      const clickedObj = checkIntersection(event);
      if (clickedObj) {
        selectObject(clickedObj);
      } else {
        deselectObject();
        // 動画再生中はクリックで再生/停止を切り替え
        if (currentVideo) {
          togglePlay(currentVideo);
        }
      }
    }
  });

  window.addEventListener("resize", handleResize, { signal: sceneSignal });
  handleResize();
  tick();

  function handleResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  function tick() {
    if (sceneSignal.aborted) return;
    requestAnimationFrame(tick);
    renderer.render(scene, camera);
    controls.update();
  }

  addEventListener('wheel', event => camera.zoom = event.deltaY * -2, { signal: sceneSignal });
  const resetBtn = document.getElementById('controlResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      controls.reset();
      controlsState = controls.saveState();
    }, { signal: sceneSignal });
  }

  // -------------------------------------------------------
  // Equirectangular Image Save
  // -------------------------------------------------------
  const saveEquirectBtn = document.getElementById('saveEquirectBtn');
  if (saveEquirectBtn) {
    saveEquirectBtn.addEventListener('click', () => {
      saveEquirectangularImage(renderer, scene);
    }, { signal: sceneSignal });
  }
}

document.getElementById('fileSelector').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const fileType = await detectFileType(file);
  if (fileType === 'unknown') {
    alert('画像または動画ファイルを選択してください')
    return;
  }
  const canvasDom = document.querySelector('canvas');
  if (canvasDom != null) {
    canvasDom.parentNode.removeChild(canvasDom);
  }
  renderScene(file, fileType);
});

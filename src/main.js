import './style.css'
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const inputFile = document.getElementById('videoFile');
inputFile.addEventListener('change', (event) => {

  const scene = new THREE.Scene();

  // カメラの作成
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 1, 1000);
  camera.position.set(0, 0, 0);
  scene.add(camera);

  // 球体の形状を作成
  const geometry = new THREE.SphereGeometry(5, 60, 40);
  geometry.scale(-1, 1, 1);

  // 動画の読み込み
  // 動画を読込む度に <canvas> が作成されるが、
  // 2回目の読込みで作成された <canvas> は1回目の読込みで作成された
  // <canvas> の下になって表示されないため、既存の <canvas> その都度削除する。
  if (document.querySelector('canvas')) {
    const videoDom = document.querySelector('canvas');
    videoDom.parentNode.removeChild(videoDom);
  }
  const videoUrl = URL.createObjectURL(inputFile.files[0]);
  const video = document.createElement("video");
  video.src = videoUrl;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.muted = true;
  video.play();

  //テクスチャーにvideoを設定
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;

  //マテリアルの作成
  const material = new THREE.MeshBasicMaterial({
    // 画像をテクスチャとして読み込み
    map: texture,
  });

  // 球体(形状)にマテリアル(質感)を貼り付けて物体を作成
  const sphere = new THREE.Mesh(geometry, material);

  //　シーンに追加
  scene.add(sphere);

  // レンダラーの作成
  const renderer = new THREE.WebGLRenderer();

  renderer.setClearColor({ color: 0x000000 });
  const element = renderer.domElement;
  document.body.append(element);
  renderer.render(scene, camera);

  // パソコン閲覧時マウスドラッグで視点操作する
  const controls = new OrbitControls(camera, element);
  controls.target.set(
    camera.position.x + 0.15,
    camera.position.y,
    camera.position.z
  );
  // 視点操作のイージングをONにする
  controls.enableDamping = true;
  // 視点操作のイージングの値
  controls.dampingFactor = 0.1;
  // 視点変更の速さ
  controls.rotateSpeed = 0.5;
  // ズーム許可
  controls.enableZoom = true;
  // パン許可
  controls.enablePan = true;
  // パンのスピード調整（デフォルトの6倍）
  controls.panSpeed = 6;
  // キーボード操作を可能にする
  controls.listenToKeyEvents(window);
  // カーソルキーでのパンのスピード調整（デフォルトの5倍）
  controls.keyPanSpeed = 35.0;
  // マウスの3つのボタンの操作を定義
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  }
  let controlsState = controls.saveState();

  // リサイズイベントを検知してリサイズ処理を実行
  window.addEventListener("resize", handleResize);
  // ここでリサイズ処理を走らせないと動画が画面全体に表示されない
  handleResize();
  tick();

  // 再生・一時停止ボタンの操作割り当て
  const playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play();
      playBtn.textContent = "||";
      playBtn.style.backgroundColor = "#F26964";
    } else {
      video.pause();
      playBtn.textContent = ">";
      playBtn.style.backgroundColor = "#1253A4";
    }
  })

  // リサイズ処理
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

  addEventListener('wheel', (event) => {
    camera.zoom = event.deltaY * -2;
  })

  document.getElementById('controlResetBtn').addEventListener('click', (event) => {
    controls.reset();
    controlsState = controls.saveState();
  })
})


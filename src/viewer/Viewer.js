import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export class Viewer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.transformControl = null;
    this.sphere = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.abortController = null;
  }

  init(texture) {
    // AbortController is managed externally (set before createTexture in renderScene)
    // If not set yet, create one
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    const signal = this.abortController.signal;

    // Cleanup previous TransformControls
    if (this.transformControl) {
      this.transformControl.dispose();
      this.transformControl = null;
    }

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 1, 1000);
    this.camera.position.set(0, 0, 0);
    this.scene.add(this.camera);

    const geometry = new THREE.SphereGeometry(5, 60, 40);
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide
    });

    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor({ color: 0x000000 });
    const element = this.renderer.domElement;
    element.style.display = "block";
    document.body.append(element);
    this.renderer.render(this.scene, this.camera);

    this.controls = new OrbitControls(this.camera, element);
    this.controls.target.set(this.camera.position.x + 0.15, this.camera.position.y, this.camera.position.z);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.rotateSpeed = 0.5;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.panSpeed = 6;
    this.controls.listenToKeyEvents(window);
    this.controls.keyPanSpeed = 35.0;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    this.controls.saveState();

    // TransformControls
    this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transformControl.getHelper());

    // Resize
    window.addEventListener("resize", () => this.handleResize(), { signal });

    // Wheel zoom
    addEventListener("wheel", event => this.camera.zoom = event.deltaY * -2, { signal });

    // Reset button
    const resetBtn = document.getElementById("controlResetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.controls.reset();
        this.controls.saveState();
      }, { signal });
    }

    this.handleResize();
    this.tick();

    return signal;
  }

  getIntersectPoint(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.sphere);
    return intersects.length > 0 ? intersects[0].point : null;
  }

  checkIntersection(event, objects) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target.parent && target.parent !== this.scene) {
        target = target.parent;
      }
      return target;
    }
    return null;
  }

  addObject(obj) {
    this.scene.add(obj);
  }

  removeObject(obj) {
    this.scene.remove(obj);
  }

  handleResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    if (this.abortController.signal.aborted) return;
    requestAnimationFrame(() => this.tick());
    this.renderer.render(this.scene, this.camera);
    this.controls.update();
  }

  get domElement() {
    return this.renderer.domElement;
  }

  dispose() {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.transformControl) {
      this.transformControl.dispose();
      this.transformControl = null;
    }
  }
}

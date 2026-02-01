import * as THREE from "three";

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

export function saveEquirectangularImage(mainRenderer, scene, transformControl) {
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

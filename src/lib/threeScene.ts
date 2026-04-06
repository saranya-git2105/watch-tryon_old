import * as THREE from "three";

export type ThreeSceneSetup = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
};

export function createThreeScene(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): ThreeSceneSetup {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  // Hemisphere light for more natural outdoor/indoor color blending
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 1.5);
  scene.add(hemiLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 3.5);
  directionalLight.position.set(2, 5, 5);
  scene.add(directionalLight);

  return {
    scene,
    camera,
    renderer,
    ambientLight,
    directionalLight,
  };
}

export function disposeThreeScene(renderer: THREE.WebGLRenderer) {
  renderer.dispose();
}
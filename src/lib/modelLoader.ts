import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

export async function loadWatchModel(url: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();

  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  return model;
}
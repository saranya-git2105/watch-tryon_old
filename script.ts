import * as fs from 'fs';
// We don't have a headless three.js environment easily setup to run GLTFLoader because it requires browser DOM (like Image).
// But we can just use a simple Node script if we have @gltf-transform/core or similar.
// Actually, it's easier to just add console.log in the frontend.

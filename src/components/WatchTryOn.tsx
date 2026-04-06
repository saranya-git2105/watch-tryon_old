"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { QRCodeSVG } from "qrcode.react";
import { Peer } from "peerjs";
import { getHandLandmarker, detectHandsFromVideo } from "@/lib/handLandmarker";
import { calculateWristPose } from "@/lib/wristPose";
import { createThreeScene, disposeThreeScene } from "@/lib/threeScene";
import { loadWatchModel } from "@/lib/modelLoader";

const WATCHES = [
  { id: "everett", name: "Everett Chronograph", brand: "FOSSIL", image: "/watches/Everett.jpg", model: "/models/watch.glb", contentWidth: 0.28, vOffset: 0, tilt: 0 },
  { id: "gold", name: "The Gold Standard", brand: "LUXE", image: "/watches/Gold.jpg", model: "/models/watch.glb", contentWidth: 0.24, vOffset: 0.04, tilt: 0.02 },
  { id: "neutra", name: "Neutra Minimalist", brand: "ARCHIVE", image: "/watches/Neutra.jpg", model: "/models/watch.glb", contentWidth: 0.26, vOffset: -0.025, tilt: -0.01 },
  { id: "pearson", name: "Pearson Traveler", brand: "HERITAGE", image: "/watches/Pearson.jpg", model: "/models/watch.glb", contentWidth: 0.30, vOffset: 0.015, tilt: 0 }
];

// Unique ID for this specific computer session
const SESSION_ID = "wrist_pro_" + Math.random().toString(36).substring(7);

export default function WatchTryOn() {
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef<number>(0);
  
  const [activeMode, setActiveMode] = useState<"CATALOG" | "QR" | "SYNCED" | "MOBILE_CAPTURE">("CATALOG");
  const [steadyProgress, setSteadyProgress] = useState(0);
  const [wristSide, setWristSide] = useState<"LEFT" | "RIGHT">("LEFT");
  const [selectedWatch, setSelectedWatch] = useState<typeof WATCHES[0] | null>(null);
  const [status, setStatus] = useState("Awaiting Global Sync...");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState("");

  const peerRef = useRef<Peer | null>(null);

  // GLOBAL PEER CONNECTION & HTTP SYNC POLLING
  useEffect(() => {
    let peer: Peer | null = null;
    try {
      peer = new Peer(SESSION_ID);
      peerRef.current = peer;

      peer.on('open', (id) => {
        const base = window.location.origin;
        setMobileUrl(`${base}/mobile?id=${SESSION_ID}`);
      });

      peer.on('connection', (conn) => {
          setStatus("Handshaking Secure Tunnel...");
          conn.on('data', (data: any) => {
              if (typeof data === "string" && data.startsWith("data:image")) {
                  setCapturedImage(data);
                  setActiveMode("SYNCED");
                  setStatus("Deep Anatomical Scan...");
              }
          });
          conn.on('open', () => {
               setStatus("Direct Global Sync Ready.");
          });
      });
    } catch (e) {
      console.warn("PeerJS Init Fail. Sync disabled.", e);
    }
    
    // Fallback HTTP Sync Polling (resolves cross-network P2P data drops)
    const intId = setInterval(async () => {
        if (activeMode !== "QR") return;
        try {
            const res = await fetch(`/api/sync?id=${SESSION_ID}`);
            const data = await res.json();
            if (data.status === "READY" && data.image) {
                setCapturedImage(data.image);
                setWristSide(data.wristSide || "LEFT");
                setActiveMode("SYNCED");
                setStatus("Deep Anatomical Scan via HTTP...");
            }
        } catch(e) {}
    }, 1500);

    return () => {
        if (peer) peer.destroy();
        clearInterval(intId);
    };
  }, [activeMode]);

  const handleManualSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = event.target?.result as string;
        setCapturedImage(img);
        setActiveMode("SYNCED");
        setStatus("Performing Deep Anatomical Scan...");
      };
      reader.readAsDataURL(file);
    }
  };

  const initThreeForImage = async (imgUrl: string, modelPath: string, side: "LEFT" | "RIGHT") => {
    if (!threeCanvasRef.current || !imgUrl) return;

    try {
      setStatus("Analysing Pro Context...");
      const img = new Image();
      img.src = imgUrl;
      await img.decode();
      
      const width = img.width;
      const height = img.height;
      threeCanvasRef.current.width = width;
      threeCanvasRef.current.height = height;

      const threeSetup = createThreeScene(threeCanvasRef.current, width, height);
      
      // Use the already decoded image for the background
      const texture = new THREE.Texture(img);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      threeSetup.scene.background = texture;

      // Use a robust native Image loader instead of TextureLoader.loadAsync
      // This prevents NextJS interception bugs that cause ThreeJS to throw raw [object Event] errors.
      const watchImg = new Image();
      watchImg.src = selectedWatch?.image || "";
      await watchImg.decode();
      const watchTex = new THREE.Texture(watchImg);
      watchTex.colorSpace = THREE.SRGBColorSpace;
      watchTex.needsUpdate = true;
      
      const watchGeom = new THREE.PlaneGeometry(1.0, 1.0); // Catalog images are square
      const watchMat = new THREE.ShaderMaterial({
          uniforms: {
              tDiffuse: { value: watchTex }
          },
          vertexShader: `
              varying vec2 vUv;
              void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
          `,
          fragmentShader: `
              uniform sampler2D tDiffuse;
              varying vec2 vUv;
              void main() {
                  vec4 texColor = texture2D(tDiffuse, vUv);
                  // The JPG background is off-white (not pure #FFF) and textures are evaluated in Linear color space internally
                  // CHROMA-KEY: DISCARD STUDIO WHITE BACKGROUNDS (JPG compression artifacts usually stay above 0.9)
                  float maxVal = max(texColor.r, max(texColor.g, texColor.b));
                  if (maxVal > 0.93) {
                      discard;
                  }

                  gl_FragColor = texColor;
              }
          `,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: true,
          depthTest: true // Re-enable depth testing because the position math is finally corrected!
      });
      const watchModel = new THREE.Mesh(watchGeom, watchMat);

      const watchGroup = new THREE.Group();
      threeSetup.scene.add(watchGroup);
      
      // Initialize flat. Rotation is applied dynamically based on detection status.
      watchModel.rotation.set(0, 0, 0);
      watchGroup.add(watchModel);

      const occluderGeom = new THREE.CylinderGeometry(1, 1, 3, 16);
      const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false });
      const wristProxyMesh = new THREE.Mesh(occluderGeom, occluderMat);
      wristProxyMesh.rotation.x = Math.PI / 2;
      threeSetup.scene.add(wristProxyMesh);

      // --- PRO STUDIO LIGHTING & SHADOWS ---
      threeSetup.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      
      const keyLight = new THREE.DirectionalLight(0xffffff, 4.5);
      keyLight.position.set(3, 8, 10);
      threeSetup.scene.add(keyLight);
      
      const rimLight = new THREE.DirectionalLight(0xffffff, 2.5);
      rimLight.position.set(-6, 2, -2);
      threeSetup.scene.add(rimLight);

      // Create high-res contact shadow texture
      const shadowSize = 256;
      const shCanvas = document.createElement('canvas');
      shCanvas.width = shadowSize;
      shCanvas.height = shadowSize;
      const shCtx = shCanvas.getContext('2d');
      if (shCtx) {
          const grad = shCtx.createRadialGradient(shadowSize/2, shadowSize/2, 0, shadowSize/2, shadowSize/2, shadowSize/2);
          grad.addColorStop(0, 'rgba(0,0,0,0.52)');
          grad.addColorStop(0.35, 'rgba(0,0,0,0.22)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          shCtx.fillStyle = grad;
          shCtx.fillRect(0, 0, shadowSize, shadowSize);
      }
      const shadowTex = new THREE.CanvasTexture(shCanvas);
      const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 1.6),
          new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
      );
      // Position shadow significantly behind the watch face
      shadowMesh.position.z = -0.01;
      watchGroup.add(shadowMesh);
      // --------------------------------------

      const landmarker = await getHandLandmarker("IMAGE");
      const result = await landmarker.detect(img);

      let pose: any = null;
      let initialWristY = 0;
      let initialAIPos = new THREE.Vector2(0, 0);
      let currentWristWidth = 0;
      let initialTy = 0;

      const showFallback = (msg: string) => {
          setStatus(msg);
          watchGroup.position.set(0, 0, 0); 
          watchGroup.scale.setScalar(2.5); 
          watchModel.rotation.set(0, 0, 0); 
          wristProxyMesh.position.set(0, 0, -10); 
          initialWristY = 0; 
          initialAIPos.set(0, 0);
          currentWristWidth = 0.5; 
          initialTy = 0;
      };

      if (result?.landmarks?.length) {
        pose = calculateWristPose(result.landmarks[0]);
        if (pose) {
          const visibleHeight = 2 * Math.tan((threeSetup.camera.fov * Math.PI) / 360) * 5;
          const visibleWidth = visibleHeight * threeSetup.camera.aspect;
          
          initialWristY = -(pose.wrist.y - 0.5) * visibleHeight;
          
          const indexTx = (pose.indexBase.x - 0.5) * visibleWidth;
          const indexTy = -(pose.indexBase.y - 0.5) * visibleHeight;
          const pinkyTx = (pose.pinkyBase.x - 0.5) * visibleWidth;
          const pinkyTy = -(pose.pinkyBase.y - 0.5) * visibleHeight;
          const palmTx = (pose.palmMid.x - 0.5) * visibleWidth;
          const palmTy = -(pose.palmMid.y - 0.5) * visibleHeight;
          const wristTx = (pose.wrist.x - 0.5) * visibleWidth;
          const wristTy = -(pose.wrist.y - 0.5) * visibleHeight;

          currentWristWidth = Math.hypot(indexTx - pinkyTx, indexTy - pinkyTy);
          const physicalWristWidth = currentWristWidth;
          const tx = (pose.watchCenter.x - 0.5) * visibleWidth;
          const ty = -(pose.watchCenter.y - 0.5) * visibleHeight;
          initialTy = ty;
          const lz = (pose.watchCenter.z || 0) * -1.2;

          let yAxis = new THREE.Vector3(palmTx - wristTx, palmTy - wristTy, 0).normalize();
          let xAxis = new THREE.Vector3(-yAxis.y, yAxis.x, 0).normalize();
          
          let naturalWristAxis = new THREE.Vector3(pinkyTx - indexTx, pinkyTy - indexTy, 0).normalize();
          if (xAxis.dot(naturalWristAxis) < 0) xAxis.negate();

          let zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
          if (zAxis.z < 0) { zAxis.negate(); xAxis.negate(); }

          const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
          const targetQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
          targetQuat.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, -0.25));

          // INDIVIDUAL WATCH CALIBRATION:
          const watchRatio = selectedWatch?.contentWidth || 0.28;
          const watchVOff = (selectedWatch as any)?.vOffset || 0;
          const watchTilt = (selectedWatch as any)?.tilt || 0;
          
          const targetWatchScalar = (physicalWristWidth * 0.52) / watchRatio;

          // Crown Flip Logic (hand-wards) + Individual Watch Tilt correction
          const zRotation = (side === "RIGHT" ? -Math.PI / 2 : Math.PI / 2) + watchTilt;
          watchModel.rotation.set(0, 0, zRotation);
          watchGroup.scale.x = (side === "RIGHT") ? -1 : 1;

          // POSITIONING: Moving the watch "down" the arm (lower Y-offset)
          // POSITIONING (User-Refined): Moving significantly towards bottom-left (down-arm)
          const finalPos = new THREE.Vector3(tx - 0.15, ty - 0.15, lz + 0.02); 
          initialAIPos.set(tx - 0.15, ty - 0.15); // Store the "Perfect" starting point
          watchGroup.position.copy(finalPos);
          watchGroup.quaternion.copy(targetQuat);
          watchGroup.scale.setScalar(targetWatchScalar); 

          // EXCLUSIVE FIX: Disabling 3D occlusion for 2D plane mode to eliminate "transparent lines"
          wristProxyMesh.position.set(0, 0, -20); 
          
          setStatus("5cm Boutique Guard Active.");
        } else {
          showFallback("AI Pose Ambiguity. Tweak Position Manually.");
        }
      } else {
        showFallback("AI Missed Hand. Drag watch to your wrist!");
      }

      // --- ADD INTERACTIVE EDITING (Drag & Scale) ---
      if (threeCanvasRef.current) {
          const canvasEl = threeCanvasRef.current;
          canvasEl.style.touchAction = 'none'; 
          canvasEl.style.cursor = 'grab';

          let isDragging = false;
          let prevPointer = { x: 0, y: 0 };

          canvasEl.addEventListener('pointerdown', (e) => {
              isDragging = true;
              canvasEl.style.cursor = 'grabbing';
              prevPointer = { x: e.clientX, y: e.clientY };
              canvasEl.setPointerCapture(e.pointerId);
          });

          canvasEl.oncontextmenu = (e) => e.preventDefault();

          canvasEl.addEventListener('pointermove', (e) => {
              if (!isDragging) return;
              
              const deltaX = e.clientX - prevPointer.x;
              const deltaY = e.clientY - prevPointer.y;

              if (e.buttons === 2 || e.shiftKey) {
                  watchModel.rotation.z -= deltaX * 0.01;
              } else {
                  const visibleHeight = 2 * Math.tan((threeSetup.camera.fov * Math.PI) / 360) * 5;
                  const visibleWidth = visibleHeight * threeSetup.camera.aspect;
                  const rect = canvasEl.getBoundingClientRect();
                  
                  const moveX = (deltaX / rect.width) * visibleWidth;
                  const moveY = -(deltaY / rect.height) * visibleHeight;

                  // CALIBRATION OVERRIDE: Hold Alt to position new watches in the future
                  if (e.altKey) {
                      watchGroup.position.x += moveX;
                      watchGroup.position.y += moveY;
                      
                      const newVOff = (watchGroup.position.y - (initialTy - 0.015));
                      const finalWidthRatio = (currentWristWidth * 0.52) / watchGroup.scale.x;
                      console.log(`%c CALIBRATION: vOffset: ${newVOff.toFixed(4)}, widthRatio: ${finalWidthRatio.toFixed(4)}`, "background: #22c55e; color: white; padding: 4px;");
                  } else {
                      const targetTx = watchGroup.position.x + moveX;
                      const targetTy = watchGroup.position.y + moveY;
                      const withinX = Math.abs(targetTx - initialAIPos.x) < 0.08;
                      const withinY = Math.abs(targetTy - initialAIPos.y) < 0.08;
                      
                      if (withinX && withinY) { 
                          watchGroup.position.x += moveX;
                          watchGroup.position.y += moveY;
                      }
                  }
              }

              threeSetup.renderer.render(threeSetup.scene, threeSetup.camera);
              prevPointer = { x: e.clientX, y: e.clientY };
          });

          const stopDrag = (e: PointerEvent) => {
              isDragging = false;
              canvasEl.style.cursor = 'grab';
              canvasEl.releasePointerCapture(e.pointerId);
          };

          canvasEl.addEventListener('pointerup', stopDrag);
          canvasEl.addEventListener('pointercancel', stopDrag);

          canvasEl.addEventListener('wheel', (e) => {
              if (e.altKey) {
                  e.preventDefault();
                  const scaleDelta = e.deltaY * -0.001; 
                  watchGroup.scale.setScalar(watchGroup.scale.x * (1 + scaleDelta));
                  
                  const finalWidthRatio = (currentWristWidth * 0.52) / watchGroup.scale.x;
                  console.log(`%c ZOOM CALIBRATION: contentWidth: ${finalWidthRatio.toFixed(4)}`, "background: #3b82f6; color: white; padding: 4px;");
                  
                  threeSetup.renderer.render(threeSetup.scene, threeSetup.camera);
              }
          }, { passive: false });
      }
      // ----------------------------------------------

      // Continuous render loop for high-res texture updates
      const render = () => {
          if (activeMode !== "SYNCED") return;
          threeSetup.renderer.render(threeSetup.scene, threeSetup.camera);
          requestAnimationFrame(render);
      };
      render();
    } catch (e) {
      console.error(e);
      setStatus("Anatomy Logic Error.");
    }
  };

  useEffect(() => {
    if (activeMode === "SYNCED" && capturedImage && selectedWatch) {
      initThreeForImage(capturedImage, selectedWatch.model, wristSide);
    }
  }, [activeMode, capturedImage, selectedWatch, wristSide]);

  const startTryOn = (watch: typeof WATCHES[0]) => {
    console.log("BOUTIQUE: Loading Try-On Session for", watch.id);
    setSelectedWatch(watch);
    
    // Skip QR and perform inline AR capture on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setActiveMode("MOBILE_CAPTURE");
    } else {
      setActiveMode("QR");
    }
  };

  // --- NATIVE MOBILE AR LOGIC ---
  const startAutoCapture = async () => {
      let steadyCount = 0;
      let lastTime = 0;
      
      const loop = async (time: number) => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
              loopRef.current = requestAnimationFrame(loop);
              return;
          }
          
          if (time - lastTime < 100) {
              loopRef.current = requestAnimationFrame(loop);
              return;
          }
          lastTime = time;

          try {
              const landmarker = await getHandLandmarker("VIDEO");
              const result = await detectHandsFromVideo(videoRef.current, performance.now());
              
              if (result?.landmarks?.length) {
                  steadyCount++;
                  setSteadyProgress(Math.min(100, (steadyCount / 15) * 100));
                  
                  if (steadyCount >= 15) {
                      captureInlineAndProcess();
                      return; // Exit loop!
                  }
              } else {
                  steadyCount = 0;
                  setSteadyProgress(0);
              }
          } catch(e) {
              console.warn("Detection skipped", e);
          }
          
          loopRef.current = requestAnimationFrame(loop);
      };
      
      loopRef.current = requestAnimationFrame(loop);
  };

  const requestInlineCamera = async () => {
    try {
      setStatus("Requesting Lens Access...");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("HTTPS Required for Camera");
        return;
      }

      setStatus("Warming AI Engine...");
      await getHandLandmarker("VIDEO");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        videoRef.current.onloadeddata = () => {
             setStatus("Lens Ready");
             startAutoCapture();
        };
      }
    } catch (err: any) {
      setStatus("Camera Error: " + err.message);
    }
  };

  const captureInlineAndProcess = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setStatus("Analysing Pro Frame...");
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.62); 
    
    cancelAnimationFrame(loopRef.current);
    
    // Stop the camera stream now that we have the photo
    const stream = video.srcObject as MediaStream;
    if (stream) {
       stream.getTracks().forEach(track => track.stop());
    }

    setCapturedImage(imageData);
    setActiveMode("SYNCED");
  };

  // Trigger camera automatically when mode switches to MOBILE_CAPTURE
  useEffect(() => {
     if (activeMode === "MOBILE_CAPTURE") {
         setSteadyProgress(0);
         requestInlineCamera();
     } else {
         cancelAnimationFrame(loopRef.current);
         // Stop camera if navigating away
         if (videoRef.current && videoRef.current.srcObject) {
             const stream = videoRef.current.srcObject as MediaStream;
             stream.getTracks().forEach(track => track.stop());
             videoRef.current.srcObject = null;
         }
     }
  }, [activeMode]);


  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 text-white selection:bg-white/10 overflow-x-hidden">
      
      {/* LUXURY NAVIGATION */}
      <nav className="w-full h-24 flex items-center justify-between px-16 border-b border-white/5 opacity-80 backdrop-blur-3xl sticky top-0 z-50">
          <div className="text-xl font-extrabold italic uppercase tracking-tighter">Nexus Pro</div>
          <div className="flex gap-12 text-[10px] uppercase font-bold tracking-[0.4em]">
              <span className="cursor-pointer hover:text-emerald-500 transition-colors">Boutique</span>
              <span className="opacity-30 cursor-not-allowed">Collections</span>
          </div>
          <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          </div>
      </nav>

      {/* CATALOG VIEW */}
      {activeMode === "CATALOG" && (
        <main className="container mx-auto py-24 px-12">
            <header className="mb-24 text-center max-w-2xl mx-auto">
                <h1 className="text-4xl font-extrabold italic uppercase mb-4 tracking-tighter">Select A Piece</h1>
                <p className="text-zinc-500 text-xs tracking-widest uppercase opacity-60">Global Cross-Network Virtual Horology Engine.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                {WATCHES.map(watch => (
                    <div key={watch.id} className="group relative">
                        <div className="aspect-square w-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 transition-all group-hover:scale-[1.02] group-hover:border-white/20 duration-700">
                             <img src={watch.image} alt={watch.name} className="w-full h-full object-contain p-12 transition-opacity" />
                             
                             <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-6 z-30">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); startTryOn(watch); }}
                                    className="relative z-40 px-8 py-4 bg-white text-black text-[10px] uppercase font-extrabold tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all shadow-3xl cursor-pointer pointer-events-auto"
                                  >
                                      Boutique Try-On
                                  </button>
                             </div>
                        </div>

                        <div className="mt-8 text-center uppercase">
                            <p className="text-zinc-500 text-[8px] tracking-[0.5em] font-bold mb-1">{watch.brand}</p>
                            <h3 className="text-lg font-bold tracking-tight">{watch.name}</h3>
                        </div>
                    </div>
                ))}
            </div>
        </main>
      )}

      {/* SYNC MODAL VIEW */}
      {activeMode === "QR" && (
        <div className="flex flex-col items-center justify-center py-24">
            <div className="bg-zinc-900 border border-white/10 p-16 rounded-[4rem] flex flex-col items-center gap-12 shadow-2xl">
                <div className="text-center">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1 animate-pulse">Global Tunnel Open</p>
                    <h2 className="text-3xl font-extrabold italic uppercase tracking-tighter">Scan Any Device</h2>
                </div>

                <div className="p-8 bg-white rounded-[3rem] shadow-[0_0_100px_rgba(255,255,255,0.05)]">
                    <QRCodeSVG value={mobileUrl} size={280} level="H" />
                </div>

                <div className="flex flex-col items-center gap-6 w-full pt-8 border-t border-white/5">
                    <p className="max-w-[280px] text-center text-[8px] text-zinc-500 uppercase tracking-widest leading-relaxed font-bold">Direct Peer Connection across all networks.</p>
                    
                    <label className="cursor-pointer px-12 py-5 bg-white/5 border border-white/10 rounded-full text-white font-extrabold uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">
                        Manual Image Sync
                        <input type="file" className="hidden" accept="image/*" onChange={handleManualSync} />
                    </label>

                    <button 
                        onClick={() => setActiveMode("CATALOG")}
                        className="text-[10px] uppercase tracking-widest font-bold text-zinc-600 hover:text-white transition-colors"
                    >
                        Close Room
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MOBILE INLINE CAPTURE VIEW */}
      {activeMode === "MOBILE_CAPTURE" && (
        <div className="flex flex-col items-center justify-center py-12 px-6 w-full flex-grow">
            <div className="relative w-full max-w-sm aspect-[3/4] overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900 shadow-2xl ring-1 ring-white/10">
              <video 
                ref={videoRef} 
                playsInline 
                muted 
                className="h-full w-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Top Banner - Reconstruction from 1916 Reference */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[85%] bg-black/60 backdrop-blur-md rounded-lg py-2 px-4 border border-white/10 z-50 flex items-center justify-between pointer-events-none">
                  <p className="text-[10px] text-white/90 font-medium">Having trouble? Try Manual <span className="underline ml-1">Turn Auto OFF</span></p>
              </div>

              <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                  <svg 
                    viewBox="0 0 300 450" 
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${wristSide === 'RIGHT' ? '-scale-x-100' : ''}`}
                    fill="none" 
                    stroke="rgba(255,255,255,0.7)" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    preserveAspectRatio="xMidYMid slice"
                  >
                      {/* Tangiblee-style horizontal hand/arm outline reconstruction */}
                      <path d="M -50,215 L 120,190 C 140,185 150,165 165,160 C 185,155 205,160 195,180 C 215,180 235,185 230,205 C 225,225 205,230 220,250 C 235,270 215,285 195,280 C 175,275 165,290 155,305 C 145,320 125,315 115,300 L -50,335" />
                      
                      {/* Watch Placement Zone */}
                      <ellipse 
                        cx="105" cy="255" 
                        rx="12" ry="25" 
                        transform="rotate(-10 105 255)" 
                        strokeDasharray="3 3" 
                        stroke={steadyProgress > 0 ? "#10b981" : "rgba(255,255,255,0.4)"} 
                        strokeWidth="1" 
                      />
                  </svg>
              </div>

              {/* Bottom Control Interface - Reconstruction from Tangiblee UI */}
              <div className="absolute bottom-6 left-0 right-0 px-6 flex flex-col items-center z-[60] pointer-events-auto">
                  
                  {/* Selector Pill centered above shutter */}
                  <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full p-1 mb-4 border border-white/10 shadow-lg">
                      <button 
                        onClick={() => setWristSide("LEFT")}
                        className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${wristSide === 'LEFT' ? 'bg-white text-black shadow-sm' : 'text-white/70'}`}
                      >
                         <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M14.5 4a1.5 1.5 0 00-3 0v4H11V2.5a1.5 1.5 0 00-3 0v6H7.5V4.5a1.5 1.5 0 00-3 0V13c0 3.5 2.5 6 6 6h2c3.5 0 6-2.5 6-6V7a1.5 1.5 0 00-3 0v2h-1V4z" />
                         </svg>
                      </button>
                      <button 
                        onClick={() => setWristSide("RIGHT")}
                        className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${wristSide === 'RIGHT' ? 'bg-white text-black shadow-sm' : 'text-white/70'}`}
                      >
                         <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="-scale-x-100">
                            <path d="M14.5 4a1.5 1.5 0 00-3 0v4H11V2.5a1.5 1.5 0 00-3 0v6H7.5V4.5a1.5 1.5 0 00-3 0V13c0 3.5 2.5 6 6 6h2c3.5 0 6-2.5 6-6V7a1.5 1.5 0 00-3 0v2h-1V4z" />
                         </svg>
                      </button>
                  </div>

                  <div className="w-full flex items-center justify-between">
                      {/* Album/Gallery Preview (Left) */}
                      <div className="w-12 h-12 rounded-lg border-2 border-white/40 overflow-hidden bg-black/40 relative cursor-pointer active:scale-95 transition-transform">
                          {capturedImage && <img src={capturedImage} className="w-full h-full object-cover" />}
                          {!capturedImage && <div className="w-full h-full flex items-center justify-center bg-white/5"><div className="w-4 h-4 rounded-full border border-white/20" /></div>}
                          <div className="absolute -top-1.5 -right-1.5 bg-black text-white text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white/30 font-bold">1</div>
                      </div>

                      {/* Large Shutter Circle (Center) */}
                      <div className="relative flex items-center justify-center">
                          <div className={`absolute w-[72px] h-[72px] rounded-full border-[3px] border-white/20 transition-all duration-300 ${steadyProgress > 0 ? 'scale-110 border-emerald-500/50' : ''}`} />
                          <button 
                            className="relative w-[58px] h-[58px] bg-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                            onClick={() => {
                                const video = videoRef.current;
                                const canvas = canvasRef.current;
                                if (video && canvas) {
                                  const ctx = canvas.getContext('2d');
                                  canvas.width = video.videoWidth;
                                  canvas.height = video.videoHeight;
                                  ctx?.drawImage(video, 0, 0);
                                  const blob = canvas.toDataURL('image/jpeg');
                                  setCapturedImage(blob);
                                  setActiveMode("SYNCED");
                                }
                            }}
                          >
                             {steadyProgress > 0 && (
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                   <circle 
                                      cx="29" cy="29" r="26" 
                                      fill="none" stroke="#10b981" strokeWidth="4"
                                      strokeDasharray={163}
                                      strokeDashoffset={163 - (163 * steadyProgress) / 100}
                                   />
                                </svg>
                             )}
                             <div className="w-[50px] h-[50px] rounded-full border border-black/5" />
                          </button>
                      </div>

                      {/* Auto Mode Control (Right) */}
                      <div className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform">
                          <div className="w-11 h-6 bg-black/40 backdrop-blur-md rounded-full relative p-1 flex items-center justify-end border border-white/10 group-active:bg-black/60">
                              <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                          </div>
                          <p className="text-[9px] text-white font-bold uppercase tracking-widest leading-none">Auto on</p>
                      </div>
                  </div>
              </div>

              {/* Status HUD (Floating slightly above controls) */}
              <div className="absolute bottom-32 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 pointer-events-none">
                  <p className="text-[7px] text-emerald-400 uppercase tracking-[0.2em] font-mono text-center whitespace-nowrap">{status}</p>
              </div>
            </div>
            
            <button 
                onClick={() => setActiveMode("CATALOG")}
                className="mt-8 text-[10px] uppercase tracking-widest font-bold text-zinc-600 hover:text-white transition-colors"
            >
                Cancel
            </button>
        </div>
      )}

      {/* RESULTS VIEW */}
      {activeMode === "SYNCED" && (
        <div className="w-full flex-grow flex flex-col items-center justify-center py-16 px-12">
            <div className="relative w-full max-w-5xl aspect-[3/4] md:aspect-video rounded-[3rem] overflow-hidden border border-white/10 shadow-3xl bg-zinc-900">
                <canvas ref={threeCanvasRef} className="w-full h-full object-contain" />
                
                <div className="absolute top-12 left-12 flex items-center gap-3 px-6 py-3 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] uppercase font-extrabold tracking-widest">{status}</span>
                </div>

                <div className="absolute bottom-12 left-12 flex gap-4">
                     <button onClick={() => window.location.reload()} className="px-8 py-4 bg-white text-black text-[10px] font-extrabold uppercase tracking-widest rounded-full">Retake</button>
                     <button onClick={() => setActiveMode("CATALOG")} className="px-8 py-4 bg-white/5 border border-white/10 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-full">Boutique Home</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
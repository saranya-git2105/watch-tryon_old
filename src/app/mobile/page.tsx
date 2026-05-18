"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Peer } from "peerjs";

import { getHandLandmarker, detectHandsFromVideo } from "@/lib/handLandmarker";

function MobileCaptureContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("id");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<any>(null);
  const loopRef = useRef<number>(0);

  const [status, setStatus] = useState("Tap to Begin Experience");
  const [captured, setCaptured] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [steadyProgress, setSteadyProgress] = useState(0);
  const [wristSide, setWristSide] = useState<"LEFT" | "RIGHT">("LEFT");

  useEffect(() => {
    // Establish Peer connection on mount
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log("Mobile Peer ID:", id);
      if (roomId) {
        const conn = peer.connect(roomId);
        connRef.current = conn;
        conn.on('open', () => {
          setConnectionStatus("Connected to Nexus");
        });
        conn.on('error', (err) => {
          setConnectionStatus("Nexus Connection Error");
        });
      }
    });

    return () => {
      peer.destroy();
      cancelAnimationFrame(loopRef.current);
    };
  }, [roomId]);

  const captureAndBeam = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setStatus("Analysing Pro Frame...");
    setCaptured(true);
    setSteadyProgress(0);
    cancelAnimationFrame(loopRef.current);
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.62); 
    
    try {
      if (roomId) {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: roomId, image: imageData, wristSide })
        });
      }
      if (connRef.current) connRef.current.send(JSON.stringify({ type: "SYNC", image: imageData, wristSide })); // Keep peer fallback just in case
      setStatus("BEAMED TO NEXUS.");
    } catch (e) {
      setStatus("Global Sync Error. Retry.");
      setCaptured(false);
    }
  };

  const startAutoCapture = async () => {
      let steadyCount = 0;
      let lastTime = 0;
      
      const loop = async (time: number) => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
              loopRef.current = requestAnimationFrame(loop);
              return;
          }
          
          // Throttle slightly to conserve battery while scanning
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
                      captureAndBeam();
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

  const requestCamera = async () => {
    try {
      setStatus("Requesting Lens Access...");
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("HTTPS Required for Camera Access");
        return;
      }

      // Pre-warm the AI model before opening the camera
      setStatus("Warming AI Engine...");
      await getHandLandmarker("VIDEO");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1080 } },
      });
      
      setCameraActive(true);
      setStatus("Lens Ready");
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
              startAutoCapture();
          };
        }
      }, 50);
    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError') {
        setStatus("Lens Blocked. Please check browser settings.");
      } else {
        setStatus("Camera Error. Try Manual Upload below.");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStatus("Processing Snapshot...");
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = event.target?.result as string;
        try {
            if (roomId) {
              await fetch('/api/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: roomId, image: img })
              });
            }
            if (connRef.current) connRef.current.send(img);
        } catch(e) {}
        setStatus("SNAPSHOT BEAMED.");
        setCaptured(true);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 text-white p-6 justify-between py-12 selection:bg-emerald-500/20 font-sans">
      <div className="text-center w-full">
        <h1 className="text-xl font-black tracking-[0.3em] uppercase italic mb-1">Nexus Sync</h1>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[7px] text-emerald-500 font-mono tracking-widest uppercase animate-pulse">{status}</p>
          <p className="text-[6px] text-zinc-500 font-mono tracking-widest uppercase">{connectionStatus}</p>
        </div>
      </div>

      {!cameraActive && !captured ? (
        <div className="flex flex-col items-center gap-8 w-full">
            <div className="w-full max-w-sm aspect-[3/4] rounded-[2.5rem] bg-zinc-900 border border-white/5 flex items-center justify-center p-8 text-center">
                 <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">Secure Tunnel Established.<br/>Tap Below to Open the Lens.</p>
            </div>
            
            <button 
              onClick={requestCamera}
              className="w-full py-6 rounded-full bg-white text-black font-black uppercase text-[10px] tracking-[0.3em] active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]"
            >
              Start Boutique Lens
            </button>

            <label className="text-[8px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1 cursor-pointer">
              Or Choose from Gallery
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
        </div>
      ) : (
        <div className="relative w-full max-w-sm aspect-[3/4] overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900 shadow-2xl ring-1 ring-white/10">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`h-full w-full object-cover transition-opacity duration-700 ${captured ? 'opacity-30 border-4 border-emerald-500' : 'opacity-100'}`} 
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Top Banner - 1916 Style */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[85%] bg-black/60 backdrop-blur-md rounded-lg py-2 px-4 border border-white/10 z-50 flex items-center justify-between pointer-events-none">
              <p className="text-[10px] text-white/90 font-medium">Having trouble? Try Manual <span className="underline ml-1">Turn Auto OFF</span></p>
          </div>

          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-40">
              {/* Hand Outline PNG Overlay */}
              <img 
                src="/hand_outline.png?v=2" 
                alt="Hand Outline Guide"
                className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-all duration-700 ${
                  wristSide === 'RIGHT' ? '-scale-x-100' : ''
                }`}
              />

              <svg 
                viewBox="0 0 1024 1024" 
                className={`absolute inset-0 w-full h-full object-contain transition-all duration-700 ${wristSide === 'RIGHT' ? '-scale-x-100' : ''}`}
                fill="none" 
                stroke="rgba(255,255,255,0.7)" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                preserveAspectRatio="xMidYMid meet"
              >
                  {/* Watch target placement area */}
                  <ellipse 
                    cx="402" cy="511" 
                    rx="40" ry="75" 
                    transform="rotate(-10 402 511)" 
                    strokeDasharray="10 10" 
                    stroke={steadyProgress > 0 ? "#10b981" : "rgba(255,255,255,0.6)"} 
                    strokeWidth="3" 
                  />
              </svg>
          </div>

          {/* Bottom Control Bar Reconstruction */}
          {!captured && (
              <div className="absolute bottom-6 left-0 right-0 px-6 flex flex-col items-center z-[60] pointer-events-auto">
                  
                  {/* Wrist Selector Pill */}
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
                      {/* Album Preview (Left) */}
                      <div className="w-12 h-12 rounded-lg border-2 border-white/40 overflow-hidden bg-black/40 relative cursor-pointer active:scale-95 transition-transform">
                          <div className="w-full h-full flex items-center justify-center bg-white/5"><div className="w-4 h-4 rounded-full border border-white/20" /></div>
                          <div className="absolute -top-1.5 -right-1.5 bg-black text-white text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white/30 font-bold">1</div>
                      </div>

                      {/* Large Shutter Circle (Center) */}
                      <div className="relative flex items-center justify-center">
                          <div className={`absolute w-[72px] h-[72px] rounded-full border-[3px] border-white/20 transition-all duration-300 ${steadyProgress > 0 ? 'scale-110 border-emerald-500/50' : ''}`} />
                          <button 
                            className="relative w-[58px] h-[58px] bg-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                            onClick={() => {
                                captureAndBeam();
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

                      {/* Auto Capture Toggle (Right) */}
                      <div className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform">
                          <div className="w-11 h-6 bg-black/40 backdrop-blur-md rounded-full relative p-1 flex items-center justify-end border border-white/10 group-active:bg-black/60">
                              <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                          </div>
                          <p className="text-[9px] text-white font-bold uppercase tracking-widest leading-none">Auto on</p>
                      </div>
                  </div>
              </div>
          )}
        </div>
      )}

      {captured && (
        <div className="flex flex-col gap-4 w-full">
            <button 
              onClick={() => { setCaptured(false); setStatus("Ready for Re-take"); }}
              className="w-full py-5 rounded-full bg-white/5 border border-white/10 text-white font-bold uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all font-mono"
            >
              Retake Snapshot
            </button>
            <p className="text-center text-[6px] text-emerald-500 uppercase tracking-widest">Image received on computer.</p>
        </div>
      )}
    </div>
  );
}

export default function MobileCapturePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Initialising Tunnel...</div>}>
      <MobileCaptureContent />
    </Suspense>
  );
}

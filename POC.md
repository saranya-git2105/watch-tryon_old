# Proof of Concept (POC) - Nexus Pro: Virtual Watch Try-On

## 1. Project Overview
**Nexus Pro** is a high-fidelity, web-based Virtual Try-On (VTO) solution specifically designed for luxury horology. The project demonstrates a seamless transition between desktop browsing and mobile AR capture, providing users with an anatomically accurate and visually premium experience for testing watch models on their own wrists.

## 2. Core Objectives
- **Anatomical Realism:** Achieve precise watch placement and orientation on the user's wrist using advanced computer vision.
- **Cross-Platform Synergy:** Leverage the desktop for browsing and the mobile device for the AR camera experience via QR-based synchronization.
- **User Agency:** Provide intuitive tools for users to fine-tune the calibration of the virtual piece.
- **Luxury Aesthetics:** Maintain a high-end "boutique" feel throughout the interface and rendering pipeline.

## 3. Key Features

### 3.1. Advanced Wrist Tracking & Pose Estimation
- **Engine:** Powered by **MediaPipe Hand Landmarker** (Mediapipe Tasks Vision).
- **Functionality:** Real-time detection of 21 hand landmarks to calculate wrist width, orientation, and 3D pose.
- **Dynamic Scaling:** Watches are automatically scaled based on the calculated physical width of the user's wrist.

### 3.2. Hybrid Sync Architecture
- **WebRTC Tunneling:** Powered by **PeerJS**, allowing direct peer-to-peer image transmission from mobile to desktop.
- **Fallback HTTP Polling:** A secondary sync mechanism ensures reliability across restrictive network environments.
- **QR Entry Point:** Desktop users can instantly bridge to the mobile AR experience without app installation.

### 3.3. High-Fidelity 3D Rendering
- **Engine:** **Three.js** with custom GLSL shaders.
- **Chroma-Key Integration:** A custom fragment shader dynamically removes studio backgrounds from product images, allowing for realistic overlays on user photos.
- **Professional Lighting:** Implementation of Key, Rim, and Ambient lighting, plus high-res contact shadows for depth.
- **Anatomical Occlusion:** (Planned/Refined) Invisible depth proxies to simulate the watch strap wrapping "around" the wrist.

### 3.4. Interactive Calibration Studio
- **Manual Adjustment:** Users can drag, rotate (Shift+Drag), and scale (Alt+Scroll) the watch for perfect alignment.
- **Wrist Logic:** Automated "Hand-wards Crown" logic that adapts the model orientation based on Left/Right wrist selection.

## 4. Technical Stack
- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **3D/CV:** [Three.js](https://threejs.org/), [MediaPipe](https://google.github.io/mediapipe/)
- **Networking:** [PeerJS](https://peerjs.com/)
- **UI/Styling:** Tailwind CSS (Modern Glassmorphism & High-Contrast Dark Mode)

## 5. Current Implementation Status
| Feature | Status | Details |
| :--- | :--- | :--- |
| **Catalog Browsing** | ✅ Completed | Luxury grid with interactive hover states. |
| **QR/Mobile Sync** | ✅ Completed | PeerJS + HTTP Fallback implemented. |
| **Native Mobile Capture** | ✅ Completed | 1916-inspired HUD with auto-capture logic. |
| **3D Alignment** | ✅ Completed | MediaPipe-based pose calculation with manual overrides. |
| **Chroma-Key Shader** | ✅ Completed | Dynamic studio background removal. |
| **Calibration Persistence**| 🚧 In Progress | Saving user-defined offsets for future sessions. |

## 6. Future Roadmap
- **Real-time Mobile AR Render:** Moving the 3D rendering engine directly into the mobile live-view.
- **Multi-Watch Comparison:** Side-by-side try-on for different models.
- **Haptic Feedback:** Tactile confirmation on mobile during successful hand detection.
- **E-commerce Integration:** "Add to Cart" and saved "My Try-On" gallery.

---
*Created by Antigravity AI for the Nexus Pro Development Team.*

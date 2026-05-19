/**
 * Fossil Virtual Watch Try-On (VTO) SDK Loader
 * Integrates the VTO experience as a lightweight, clean, and zero-dependency widget.
 */
(function () {
  const SCRIPT_NAME = "Fossil VTO SDK";
  console.log(`[${SCRIPT_NAME}] Initializing...`);

  // Server URL of the hosted Watch Try-On system
  // Configured to point directly to your active public dev tunnel for live mobile sync
  const VTO_HOST = 'http://20.197.47.191:3221';

  // Global styles for the premium CTA button and modal overlay
  const STYLES = `
    /* Absolute positioning over Fossil image gallery column */
    #fossil-tryon-container {
      position: absolute;
      bottom: 24px;
      left: 24px;
      z-index: 99;
    }

    /* Elegant White Pill Button Matching Fossil US */
    .fossil-vto-btn {
      background-color: #ffffff !important;
      color: #222222 !important;
      border: 1px solid #d2d2d2 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
      font-family: "Inter", "Helvetica Neue", sans-serif;
      font-size: 13px !important;
      font-weight: 500 !important;
      letter-spacing: 0.5px !important;
      text-transform: capitalize !important;
      padding: 10px 20px !important;
      border-radius: 4px !important;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      height: auto !important;
    }

    .fossil-vto-btn:hover {
      background-color: #f7f7f7 !important;
      border-color: #bbbbbb !important;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12) !important;
      transform: translateY(-1px);
    }

    .fossil-vto-btn svg {
      margin-right: 8px;
      color: #333333;
      transition: transform 0.25s ease;
    }

    .fossil-vto-btn:hover svg {
      transform: scale(1.1);
    }

    /* Modal Backdrop Blur */
    .fossil-vto-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .fossil-vto-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    /* Beautiful White Card Modal Matching Tangiblee */
    .fossil-vto-modal {
      width: 95%;
      max-width: 720px;
      height: 720px;
      max-height: 95%;
      background: #ffffff;
      border: 1px solid #f0f0f0;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
      border-radius: 12px;
      position: relative;
      transform: scale(0.95);
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .fossil-vto-overlay.active .fossil-vto-modal {
      transform: scale(1);
    }

    /* Sleek Circular Close Button */
    .fossil-vto-close {
      position: absolute;
      top: 15px;
      right: 15px;
      width: 32px;
      height: 32px;
      background: #f3f3f3;
      border: 1px solid #e6e6e6;
      color: #333333;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 20px;
      border-radius: 50%;
      z-index: 10;
      transition: all 0.2s ease;
    }

    .fossil-vto-close:hover {
      background: #e6e6e6;
      color: #000000;
    }

    /* VTO Iframe styling */
    .fossil-vto-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    }
  `;

  // Dynamic SVG Camera/AR Icon
  const BUTTON_ICON = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  `;

  // Inject Styles into Head
  function injectStyles() {
    if (document.getElementById("fossil-vto-styles")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "fossil-vto-styles";
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  // Create Modal Overlay Structure
  let overlayEl = null;
  let iframeEl = null;

  function createModal() {
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.className = "fossil-vto-overlay";
    overlayEl.innerHTML = `
      <div class="fossil-vto-modal">
        <button class="fossil-vto-close" title="Close Try-On">&times;</button>
        <iframe class="fossil-vto-iframe" allow="camera" title="Virtual Try-On"></iframe>
      </div>
    `;

    document.body.appendChild(overlayEl);
    iframeEl = overlayEl.querySelector(".fossil-vto-iframe");

    // Close handlers
    const closeBtn = overlayEl.querySelector(".fossil-vto-close");
    closeBtn.addEventListener("click", closeModal);
    overlayEl.addEventListener("click", function (e) {
      if (e.target === overlayEl) closeModal();
    });
  }

  function openModal(watchId, watchImage, watchName, watchBrand, watchPrice) {
    createModal();
    injectStyles();

    // Compile absolute URL parameters to pass to the AR Try-On workspace
    const params = new URLSearchParams({
      watchId: watchId || "",
      watchImage: watchImage || "",
      watchName: watchName || "",
      watchBrand: watchBrand || "FOSSIL",
      watchPrice: watchPrice || "",
      sdk: "true"
    });

    const vtoUrl = `${VTO_HOST}/?${params.toString()}`;
    console.log(`[${SCRIPT_NAME}] Launching VTO Iframe URL:`, vtoUrl);

    iframeEl.src = vtoUrl;
    overlayEl.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent background body scroll
  }

  function closeModal() {
    if (!overlayEl) return;
    overlayEl.classList.remove("active");
    document.body.style.overflow = "";
    // Wait for transition before resetting iframe source (prevents flash)
    setTimeout(() => {
      if (iframeEl) iframeEl.src = "about:blank";
    }, 350);
  }

  // Main dynamic button mounting scan
  function mountTryOnWidget() {
    const dataContainer = document.getElementById("fossil-tryon-container");
    if (!dataContainer) return;

    // Check if the VTO button is already mounted anywhere on the page
    if (document.querySelector(".fossil-vto-btn")) {
      return; // Already initialized
    }

    // Hide the original metadata element to keep Fossil's grid flow completely untouched
    dataContainer.style.display = 'none';

    let attempts = 0;
    const maxAttempts = 30; // Poll for up to 6 seconds for client hydration to complete

    function findImageWrapper() {
      return document.querySelector(".productsBlock .product-card-trigger")
        || document.querySelector(".productsBlock .product-card")
        || document.querySelector(".mobile-slide-image-wrapper")
        || document.querySelector(".reval-mobile-slide")
        || document.querySelector(".pdp-thumbnail-gallery__main")
        || document.querySelector(".pdp-carousel-gallery__viewport")
        || document.querySelector(".product-card-trigger")
        || document.querySelector(".product-card");
    }

    function tryMount() {
      const targetMount = findImageWrapper();

      if (!targetMount) {
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryMount, 200); // Check again in 200ms
        } else {
          // Final fallback to visible container if gallery never loads
          const fallback = document.querySelector(".pdp-interactive-gallery") || dataContainer;
          if (fallback) {
            dataContainer.style.display = fallback === dataContainer ? 'block' : 'none';
            mountTo(fallback);
          }
        }
        return;
      }

      mountTo(targetMount);
    }

    function mountTo(mountPoint) {
      if (document.querySelector(".fossil-vto-btn")) return;

      // Ensure the targeted container has relative positioning so the absolute overlay button binds correctly
      if (mountPoint !== dataContainer) {
        mountPoint.style.position = 'relative';
      }

      console.log(`[${SCRIPT_NAME}] Target image container detected. Mounting CTA...`);
      injectStyles();

      // Create CTA Button
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fossil-vto-btn";
      button.innerHTML = `${BUTTON_ICON}<span>Try On</span>`;

      // Extract attributes dynamically from metadata container
      const getAttributes = () => {
        let rawImage = dataContainer.getAttribute("data-watch-image") || "";
        // Convert relative e-commerce paths to fully qualified absolute URLs
        if (rawImage && !rawImage.startsWith("http://") && !rawImage.startsWith("https://")) {
          const origin = window.location.origin;
          rawImage = origin + (rawImage.startsWith("/") ? "" : "/") + rawImage;
        }

        return {
          id: dataContainer.getAttribute("data-watch-id") || "",
          image: rawImage,
          name: dataContainer.getAttribute("data-watch-name") || "",
          brand: dataContainer.getAttribute("data-watch-brand") || "FOSSIL",
          price: dataContainer.getAttribute("data-watch-price") || "",
        };
      };

      // Handle Click (Prevent triggers from passing down to image zoom overlays)
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        const attrs = getAttributes();
        openModal(attrs.id, attrs.image, attrs.name, attrs.brand, attrs.price);
      });

      // Append Button to targeted image container
      mountPoint.appendChild(button);
    }

    tryMount();

    // Watch for Swatch Variant Updates (Attribute Changes)
    const observer = new MutationObserver(() => {
      console.log(`[${SCRIPT_NAME}] Variant update detected. Syncing VTO attributes...`);
    });
    observer.observe(dataContainer, { attributes: true });
  }

  // Run immediately and listen for DOM mutations (for SPA dynamic hydration support)
  if (document.readyState === "complete" || document.readyState === "interactive") {
    mountTryOnWidget();
  } else {
    document.addEventListener("DOMContentLoaded", mountTryOnWidget);
  }

  // Set up global observer to scan for container dynamic mounts (Next.js SPA routing)
  const globalObserver = new MutationObserver(mountTryOnWidget);
  globalObserver.observe(document.body, { childList: true, subtree: true });

})();

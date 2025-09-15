// content.js — Focus / Kindle with paper texture & safe cleanup

(function () {
  // 兼容 Chrome 和 Safari
  const browser = window.chrome || window.safari;
  
  // Run only in top frame to avoid duplicate overlays
  try { if (window.top !== window.self) return; } catch (_) { return; }
  if (window.__EINK_CS_LOADED__) return;
  window.__EINK_CS_LOADED__ = true;
  console.log("✅ content.js loaded");

  let mode = null; // "focus" | "kindle" | null
  let colorMode = "bw"; // "full" | "soft" | "bw" | null
  let overlayEl = null;
  let ghostTimer = null;
  let toastTimeout = null;
  let filterStyleEl = null;

  // ---- Utils ----
  function showToast(text) {
    clearToast();
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
    const t = document.createElement("div");
    t.id = "eink-toast";
    Object.assign(t.style, {
      position: "fixed",
      top: "10px",
      right: "12px",
      zIndex: 2147483647,
      background: "rgba(20,20,20,0.85)",
      color: "#fff",
      font: "13px/1.4 -apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
      padding: "8px 10px",
      borderRadius: "6px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity .2s ease",
    });
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(() => (t.style.opacity = "1"));
    toastTimeout = setTimeout(() => {
      if (t) t.style.opacity = "0";
      toastTimeout = setTimeout(() => {
        clearToast();
        toastTimeout = null;
      }, 300);
    }, 1500);
  }

  function clearToast() {
    const old = document.getElementById("eink-toast");
    if (old) old.remove();
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }

  function getFilter(cMode) {
    if (cMode === "full") return "contrast(1.02) brightness(0.98)";
    if (cMode === "soft") return "saturate(0.5) contrast(1.05) brightness(0.98)";
    if (cMode === "bw") return "grayscale(1) contrast(1.25) brightness(1.05)";
    return "";
  }

  function ensureFilterStyle() {
    if (filterStyleEl && document.documentElement.contains(filterStyleEl)) return filterStyleEl;
    const exist = document.getElementById("eink-filter-style");
    filterStyleEl = exist || document.createElement("style");
    filterStyleEl.id = "eink-filter-style";
    document.documentElement.appendChild(filterStyleEl);
    return filterStyleEl;
  }
  function setPageFilter(filterStr) {
    const el = ensureFilterStyle();
    const css = `:root{filter:${filterStr} !important;-webkit-filter:${filterStr} !important;}`;
    if (el.textContent !== css) el.textContent = css;
  }
  function clearPageFilter() {
    if (filterStyleEl && filterStyleEl.parentNode) {
      filterStyleEl.parentNode.removeChild(filterStyleEl);
    }
    filterStyleEl = null;
  }

  // ---- Paper Texture ----
  function makePaperTexture(w = 300, h = 300, alpha = 255) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255; // full range for visibility
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  function ensureOverlay(opacity = 1.0, blendMode = "multiply") {
    clearOverlay();
    overlayEl = document.createElement("div");
    overlayEl.id = "eink-overlay";
    Object.assign(overlayEl.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      pointerEvents: "none",
      backgroundRepeat: "repeat",
      backgroundSize: "200px 200px",
      backgroundImage: `url(${makePaperTexture()})`,
      opacity: String(opacity),
      mixBlendMode: blendMode,
    });
    document.body.appendChild(overlayEl);
  }

  function clearOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  function stopGhosting() {
    if (ghostTimer) {
      clearInterval(ghostTimer);
      ghostTimer = null;
    }
  }

  // ---- Kindle Typography ----
  function applyKindleTypography() {
    try {
      const textEls = document.querySelectorAll(
        "body, p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, a, strong, em, b, i, pre, code"
      );
      textEls.forEach((el) => {
        const cs = window.getComputedStyle(el);
        const fontSize = parseFloat(cs.fontSize) || 16;
        const lang = el.lang || document.documentElement.lang || "";
        el.style.fontFamily = '"Georgia","Times New Roman",serif';
        el.style.textRendering = "optimizeLegibility";
        if (/zh/i.test(lang) && fontSize <= 14) {
          el.style.textShadow = "0 0 0.3px rgba(0,0,0,0.07)";
          el.style.letterSpacing = "0.01em";
          el.style.webkitFontSmoothing = "antialiased";
        } else {
          el.style.textShadow = "0 0 3px rgba(0,0,0,0.33)";
          el.style.letterSpacing = "0.06em";
          el.style.webkitFontSmoothing = "none";
        }
      });
    } catch (_) {}
  }

  function resetKindleTypography() {
    try {
      const textEls = document.querySelectorAll(
        "body, p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, a, strong, em, b, i, pre, code"
      );
      textEls.forEach((el) => {
        el.style.fontFamily = "";
        el.style.textRendering = "";
        el.style.textShadow = "";
        el.style.letterSpacing = "";
        el.style.webkitFontSmoothing = "";
      });
    } catch (_) {}
  }

  // ---- Mode Apply ----
  function applyFocus() {
    resetKindleTypography();
    clearOverlay();
    clearToast();
    stopGhosting();
    setPageFilter(getFilter(colorMode));
    document.documentElement.style.backgroundColor = "#f9f9f5";  // 与 Kindle 模式一致
    ensureOverlay(0.18, "soft-light");  // 与 Kindle 模式保持一致
    ghostTimer = setInterval(() => {
      if (overlayEl) {
        overlayEl.style.backgroundImage = `url(${makePaperTexture()})`;
      }
    }, 4000);  // 与 Kindle 模式保持一致
    clearToast();
    showToast("📖 Focus 模式已启用");
    // 兼容 Chrome 和 Safari 的存储
    if (window.chrome) {
      chrome.storage?.local?.set?.({ mode, colorMode });
    } else if (window.safari) {
      try {
        localStorage.setItem('eink_mode', mode);
        localStorage.setItem('eink_colorMode', colorMode);
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    }
  }

  function applyKindle() {
    clearOverlay();
    clearToast();
    stopGhosting();
    setPageFilter(getFilter(colorMode));
    document.documentElement.style.backgroundColor = "#f9f9f5";
    applyKindleTypography();
    ensureOverlay(0.18, "soft-light");
    ghostTimer = setInterval(() => {
      if (overlayEl) {
        overlayEl.style.backgroundImage = `url(${makePaperTexture()})`;
      }
    }, 4000);
    clearToast();
    showToast("📚 Kindle 模式已启用");
    // 兼容 Chrome 和 Safari 的存储
    if (window.chrome) {
      chrome.storage?.local?.set?.({ mode, colorMode });
    } else if (window.safari) {
      try {
        localStorage.setItem('eink_mode', mode);
        localStorage.setItem('eink_colorMode', colorMode);
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    }
  }

  function disableModes() {
    stopGhosting();
    clearOverlay();
    clearToast();
    resetKindleTypography();
    clearPageFilter();
    document.documentElement.style.backgroundColor = "";
    mode = null;
    // 兼容 Chrome 和 Safari 的存储
    if (window.chrome) {
      chrome.storage?.local?.set?.({ mode, colorMode });
    } else if (window.safari) {
      try {
        localStorage.setItem('eink_mode', mode);
        localStorage.setItem('eink_colorMode', colorMode);
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    }
    clearToast();
    showToast("❌ 模式已关闭");
  }

  // ---- Messages ----
  if (window.chrome) {
    // Chrome 消息监听
    chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "toggleEink") {
      if (mode === "focus") {
        disableModes();
      } else {
        mode = "focus";
        applyFocus();
        chrome.storage?.local?.set?.({ mode, colorMode });
      }
    }
    if (msg.action === "toggleKindle") {
      if (mode === "kindle") {
        disableModes();
      } else {
        mode = "kindle";
        applyKindle();
        chrome.storage?.local?.set?.({ mode, colorMode });
      }
    }
    if (msg.action === "setColorMode") {
      colorMode = msg.value;
      // 只更新滤镜，不重建整个模式
      setPageFilter(getFilter(colorMode));
      chrome.storage?.local?.set?.({ mode, colorMode });
    }
    
    if (msg.action === "forceApply") {
      if (typeof msg.mode !== "undefined") mode = msg.mode;
      if (typeof msg.colorMode !== "undefined") colorMode = msg.colorMode;
      if (mode === "focus") applyFocus();
      else if (mode === "kindle") applyKindle();
      else disableModes();
      
      // Handle reader mode state if available
      if (typeof msg.readerActive !== "undefined" && window.toggleReaderMode && typeof window.isReaderActive === 'function') {
        if (msg.readerActive && !window.isReaderActive()) {
          window.toggleReaderMode();
        } else if (!msg.readerActive && window.isReaderActive()) {
          window.toggleReaderMode();
        }
      }
        }
        if (msg.action === "toggleReader") {
          // 切换阅读器模式
          if (window.toggleReaderMode) {
            window.toggleReaderMode();
          }
        }
    return true;
  });
  } else if (window.safari) {
    // Safari 消息监听
    safari.self.addEventListener("message", (event) => {
      const msg = event.message;
      if (msg.action === "toggleEink") {
        if (mode === "focus") {
          disableModes();
        } else {
          mode = "focus";
          applyFocus();
        }
      }
      if (msg.action === "toggleKindle") {
        if (mode === "kindle") {
          disableModes();
        } else {
          mode = "kindle";
          applyKindle();
        }
      }
      if (msg.action === "setColorMode") {
        colorMode = msg.value;
        // 只更新滤镜，不重建整个模式
        setPageFilter(getFilter(colorMode));
      }
      if (msg.action === "forceApply") {
        if (typeof msg.mode !== "undefined") mode = msg.mode;
        if (typeof msg.colorMode !== "undefined") colorMode = msg.colorMode;
        if (mode === "focus") applyFocus();
        else if (mode === "kindle") applyKindle();
        else disableModes();
        
        // Handle reader mode state if available
        if (typeof msg.readerActive !== "undefined" && window.toggleReaderMode && typeof window.isReaderActive === 'function') {
          if (msg.readerActive && !window.isReaderActive()) {
            window.toggleReaderMode();
          } else if (!msg.readerActive && window.isReaderActive()) {
            window.toggleReaderMode();
          }
        }
      }
      if (msg.action === "toggleReader") {
        // 切换阅读器模式
        if (window.toggleReaderMode) {
          window.toggleReaderMode();
        }
      }
    });
  }

  // ---- MutationObserver (忽略 style 节点) ----
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeName === "STYLE") return; // 跳过 <style>
      });
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  // ---- Initial Apply ----
  if (window.chrome) {
    // Chrome 存储初始化
    chrome.storage?.local?.get(["mode", "colorMode"], (data) => {
      if (data) {
        if (typeof data.mode !== "undefined") mode = data.mode;
        if (typeof data.colorMode !== "undefined") colorMode = data.colorMode;
        if (mode === "focus") applyFocus();
        else if (mode === "kindle") applyKindle();
      }
    });
  } else if (window.safari) {
    // Safari 存储初始化（Safari 扩展的存储 API 略有不同）
    try {
      // 尝试从 Safari 的存储中获取设置
      // 注意：Safari 15+ 也支持类似 Chrome 的 storage API，但为了兼容性，我们使用简单的实现
      const storedMode = localStorage.getItem('eink_mode');
      const storedColor = localStorage.getItem('eink_colorMode');
      
      if (storedMode) mode = storedMode;
      if (storedColor) colorMode = storedColor;
      
      if (mode === "focus") applyFocus();
      else if (mode === "kindle") applyKindle();
    } catch (e) {
      console.error("Error initializing from storage:", e);
    }
  }
})();

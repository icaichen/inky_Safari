// popup.js — per-tab state; reader button driven by content.js, not storage

// 兼容 Chrome 和 Safari
const browser = window.chrome || window.safari;

async function withTab(fn) {
  try {
    if (window.chrome) {
      // Chrome 实现
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !/^https?:\/\//.test(tab.url)) {
        console.warn("This page is not supported:", tab?.url);
        return;
      }
      return fn(tab);
    } else if (window.safari) {
      // Safari 实现
      const tab = safari.application.activeBrowserWindow.activeTab;
      if (!tab?.url || !/^https?:\/\//.test(tab.url)) {
        console.warn("This page is not supported:", tab?.url);
        return;
      }
      return fn({ id: 0, url: tab.url }); // Safari 不使用 tabId
    }
  } catch (error) {
    console.error("Error getting active tab:", error);
  }
}

function send(tabId, msg, cb) {
  try {
    if (window.chrome) {
      // Chrome 实现
      chrome.tabs.sendMessage(tabId, msg, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message error:", chrome.runtime.lastError.message);
          cb?.(undefined);
        } else {
          cb?.(response);
        }
      });
    } else if (window.safari) {
      // Safari 实现
      safari.extension.dispatchMessage(msg.action, msg);
      cb?.({}); // Safari 不支持回调响应
    }
  } catch (error) {
    console.error("Error sending message:", error);
    cb?.(undefined);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btnEink   = document.getElementById("toggleEink");
  const btnKindle = document.getElementById("toggleKindle");
  const btnReader = document.getElementById("toggleReader");
  const colorSelect = document.getElementById("colorSelect");

  let currentMode  = null;   // "focus" | "kindle" | null  —— 来自 storage
  let currentColor = null;   // "full" | "soft" | "bw" | null —— 来自 storage
  let readerActive = false;  // 阅读模式状态

  const setActive = (el, on) => el && (on ? el.classList.add("active") : el.classList.remove("active"));

  function render() {
    setActive(btnEink,   currentMode === "focus");
    setActive(btnKindle, currentMode === "kindle");
    setActive(btnReader, readerActive);

    // 下拉框永远可见；无模式时显示空值（点了也不会生效）
    colorSelect.style.display = "block";
    colorSelect.value = !currentMode ? "" : (currentColor ?? "");
  }

  // ---- 初始化：模式/颜色仍沿用 storage ----
  if (window.chrome) {
    chrome.storage.local.get(["mode", "colorMode", "readerActive"], (s) => {
      currentMode  = s.mode ?? null;
      currentColor = s.colorMode ?? null;
      readerActive = s.readerActive ?? false;
      render();
    });
  } else if (window.safari) {
    try {
      const mode = localStorage.getItem('eink_mode');
      const colorMode = localStorage.getItem('eink_colorMode');
      const readerState = localStorage.getItem('eink_readerActive');
      currentMode = mode === 'null' ? null : mode;
      currentColor = colorMode === 'null' ? null : colorMode;
      readerActive = readerState === 'true';
      render();
    } catch (e) {
      console.error("Error loading settings from localStorage:", e);
    }
  }

  // 外部修改监听
  if (window.chrome) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.mode) {
        currentMode = changes.mode.newValue ?? null;
        if (!currentMode) currentColor = null;
      }
      if (changes.colorMode) {
        currentColor = changes.colorMode.newValue ?? null;
      }
      if (changes.readerActive !== undefined) {
        readerActive = changes.readerActive.newValue ?? false;
      }
      render();
    });
  } else if (window.safari) {
    // Safari 使用 localStorage 事件监听
    window.addEventListener('storage', (e) => {
      if (e.key === 'eink_mode') {
        currentMode = e.newValue === 'null' ? null : e.newValue;
        if (!currentMode) currentColor = null;
        render();
      } else if (e.key === 'eink_colorMode') {
        currentColor = e.newValue === 'null' ? null : e.newValue;
        render();
      } else if (e.key === 'eink_readerActive') {
        readerActive = e.newValue === 'true';
        render();
      }
    });
  }

  // ---- 点击处理 ----
  btnEink?.addEventListener("click", () => {
    currentMode = currentMode === "focus" ? null : "focus";
    if (!currentMode) currentColor = null;
    
    // 兼容 Chrome 和 Safari 的存储
    if (window.chrome) {
      chrome.storage.local.set({ mode: currentMode, colorMode: currentColor });
    } else if (window.safari) {
      try {
        localStorage.setItem('eink_mode', currentMode);
        localStorage.setItem('eink_colorMode', currentColor);
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    }
    
    render();
    withTab(tab => send(tab.id, { action: "toggleEink" }));
  });

  btnKindle?.addEventListener("click", () => {
    currentMode = currentMode === "kindle" ? null : "kindle";
    if (!currentMode) currentColor = null;
    
    // 兼容 Chrome 和 Safari 的存储
    if (window.chrome) {
      chrome.storage.local.set({ mode: currentMode, colorMode: currentColor });
    } else if (window.safari) {
      try {
        localStorage.setItem('eink_mode', currentMode);
        localStorage.setItem('eink_colorMode', currentColor);
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    }
    
    render();
    withTab(tab => send(tab.id, { action: "toggleKindle" }));
  });

  colorSelect?.addEventListener("change", () => {
    if (!currentMode) { // 无模式时不允许选择颜色
      colorSelect.value = "";
      currentColor = null;
      render();
      return;
    }
    currentColor = colorSelect.value || null;
    
    // 兼容 Chrome 和 Safari 的存储
    if (window.chrome) {
      chrome.storage.local.set({ mode: currentMode, colorMode: currentColor });
    } else if (window.safari) {
      try {
        localStorage.setItem('eink_mode', currentMode);
        localStorage.setItem('eink_colorMode', currentColor);
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    }
    
    render();
    withTab(tab => send(tab.id, { action: "setColorMode", value: currentColor }));
  });

  // 阅读器模式切换
  btnReader?.addEventListener("click", () => {
    readerActive = !readerActive;
    
    // 兼容 Chrome 和 Safari 的存储
    if (window.chrome) {
      chrome.storage.local.set({ readerActive });
    } else if (window.safari) {
      try {
        localStorage.setItem('eink_readerActive', readerActive ? 'true' : 'false');
      } catch (e) {
        console.error("Error saving reader state to localStorage:", e);
      }
    }
    
    render();
    withTab(tab => send(tab.id, { action: "toggleReader" }));
  });

  console.log("✅ Popup loaded");
});

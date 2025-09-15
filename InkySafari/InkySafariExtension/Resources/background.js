// background.js — persist state, re-apply on navigation/activation, badge indicator

// 浏览器兼容性检测
const isSafari = typeof window !== 'undefined' && window.safari !== undefined;
const browser = isSafari ? window.safari : window.chrome;

// 兼容的存储函数
function storageGet(keys, callback) {
  if (isSafari) {
    try {
      const result = {};
      keys.forEach(key => {
        const value = localStorage.getItem(`eink_${key}`);
        if (value !== null) {
          result[key] = value === 'null' ? null : value;
        }
      });
      callback(result);
    } catch (e) {
      console.error("Error reading from localStorage:", e);
      callback({});
    }
  } else {
    browser.storage.local.get(keys, callback);
  }
}

function storageSet(items, callback) {
  if (isSafari) {
    try {
      Object.keys(items).forEach(key => {
        localStorage.setItem(`eink_${key}`, items[key]);
      });
      if (callback) callback();
    } catch (e) {
      console.error("Error writing to localStorage:", e);
      if (callback) callback();
    }
  } else {
    browser.storage.local.set(items, callback);
  }
}

// 兼容的消息发送函数
function safeSend(tabId, msg) {
  try {
    if (isSafari) {
      // Safari 的消息发送方式
      const message = browser.extensionMessage.sendMessage(msg);
      if (message && typeof message.then === 'function') {
        message.then(() => {}, () => {});
      }
    } else {
      browser.tabs.sendMessage(tabId, msg, () => { 
        if (browser.runtime.lastError) {
          // 忽略错误
        } 
      });
    }
  } catch(_) {}
}

// 兼容的 badge 设置函数
function setBadgeText(text) {
  if (isSafari) {
    // Safari 不支持 action.setBadgeText，使用扩展图标代替
    return;
  } else {
    // Chrome 支持 action 或 browserAction
    if (browser.action) {
      browser.action.setBadgeText({ text });
      if (text) browser.action.setBadgeBackgroundColor({ color: "#222" });
    } else if (browser.browserAction) {
      browser.browserAction.setBadgeText({ text });
      if (text) browser.browserAction.setBadgeBackgroundColor({ color: "#222" });
    }
  }
}

// 初始化存储
if (browser.runtime && browser.runtime.onInstalled) {
  browser.runtime.onInstalled.addListener(() => {
    storageGet(["mode", "colorMode", "readerActive"], (s) => {
      if (s.mode === undefined) storageSet({ mode: null });
      // Do not default any color mode; keep it unset until user chooses
      if (s.colorMode === undefined) storageSet({ colorMode: null });
      if (s.readerActive === undefined) storageSet({ readerActive: false });
    });
  });
}

if (browser.runtime && browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(() => { updateBadgeFromStorage(); });
}

function isHttp(url) { return /^https?:\/\//.test(url || ""); }

function applyToTab(tabId, url) {
  if (!url) return;
  if (!isHttp(url)) return; // ignore chrome://newtab 等
  storageGet(["mode", "colorMode", "readerActive"], ({ mode, colorMode, readerActive }) => {
    safeSend(tabId, { action: "forceApply", mode, colorMode, readerActive });
  });
}

// 页面加载完成时尝试恢复
if (browser.webNavigation && browser.webNavigation.onCompleted) {
  browser.webNavigation.onCompleted.addListener(({ tabId, url }) => {
    try {
      if (!url || !isHttp(url)) return;
      applyToTab(tabId, url);
    } catch (_) {}
  });
}

// 激活标签时尝试恢复
if (browser.tabs && browser.tabs.onActivated) {
  browser.tabs.onActivated.addListener(({ tabId }) => {
    try {
      browser.tabs.get(tabId, (tab) => {
        if (tab && tab.url) applyToTab(tab.id, tab.url);
      });
    } catch (_) {}
  });
}

// 监听 SPA 页面，捕捉 history state 更新
if (browser.webNavigation && browser.webNavigation.onHistoryStateUpdated) {
  browser.webNavigation.onHistoryStateUpdated.addListener(({ tabId, url }) => {
    try {
      if (!url || !isHttp(url)) return;
      applyToTab(tabId, url);
    } catch (_) {}
  });
}

// 徽标同步
function updateBadgeFromStorage() {
  storageGet(["mode", "readerActive"], ({ mode, readerActive }) => {
    let text = "";
    if (readerActive) {
      text = "R";
    } else if (mode === "kindle") {
      text = "K";
    } else if (mode === "focus") {
      text = "E";
    }
    setBadgeText(text);
  });
}

// 存储变化监听 - Chrome 方式
if (!isSafari && browser.storage && browser.storage.onChanged) {
  browser.storage.onChanged.addListener((changes) => {
    if (changes.mode || changes.colorMode || changes.readerActive) updateBadgeFromStorage();
  });
}

// Safari 中使用 localStorage 事件监听
if (isSafari && typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'eink_mode' || e.key === 'eink_colorMode' || e.key === 'eink_readerActive') {
      updateBadgeFromStorage();
    }
  });
}

// 初始化时更新徽标
updateBadgeFromStorage();

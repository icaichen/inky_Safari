// This is a simplified version of Mozilla's Readability library
// Original source: https://github.com/mozilla/readability

// 确保在全局window对象上可用，兼容Chrome和Safari扩展环境
(function(window) {
  'use strict';

  class Readability {
    constructor(doc, options = {}) {
      this.doc = doc;
      this.options = options;
      this.articleTitle = '';
      this.articleByline = '';
      this.articleDir = '';
      this.articleContent = '';
      this.articleExcerpt = '';
      this.articleSiteName = '';
      this.articlePublishedTime = '';
    }

    parse() {
      try {
        // Clone the document to avoid modifying the original
        const docClone = this.doc.cloneNode(true);
        
        // Remove unwanted elements
        this._cleanStyles(docClone);
        this._removeScripts(docClone);
        this._removeUnlikelyCandidates(docClone);
        this._removeHiddenElements(docClone);
        
        // Find the main content
        const article = this._getArticle(docClone);
        if (!article) return null;
        
        // Extract metadata
        this._extractMetadata(docClone);
        
        // Process the content
        this._processContent(article);
        
        // Create the result
        return {
          title: this.articleTitle,
          byline: this.articleByline,
          dir: this.articleDir,
          content: this.articleContent,
          excerpt: this.articleExcerpt,
          siteName: this.articleSiteName,
          publishedTime: this.articlePublishedTime
        };
      } catch (e) {
        console.error('Readability parse error:', e);
        return null;
      }
    }

    _cleanStyles(doc) {
      // Remove inline styles
      const elements = doc.querySelectorAll('[style]');
      for (let i = 0; i < elements.length; i++) {
        elements[i].removeAttribute('style');
      }

      // Remove style tags
      const styleTags = doc.querySelectorAll('style');
      for (let i = 0; i < styleTags.length; i++) {
        styleTags[i].remove();
      }
    }

    _removeScripts(doc) {
      const scripts = doc.querySelectorAll('script, noscript');
      for (let i = 0; i < scripts.length; i++) {
        scripts[i].remove();
      }
    }

    _removeUnlikelyCandidates(doc) {
      const unlikelyCandidates = doc.querySelectorAll(
        'aside, footer, header, nav, script, style, [role="banner"], [role="complementary"], [role="navigation"], [role="search"], [aria-hidden="true"]'
      );
      for (let i = 0; i < unlikelyCandidates.length; i++) {
        unlikelyCandidates[i].remove();
      }
    }

    _removeHiddenElements(doc) {
      const elements = doc.querySelectorAll('*');
      for (let i = 0; i < elements.length; i++) {
        const style = window.getComputedStyle(elements[i]);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          elements[i].remove();
        }
      }
    }

    _getArticle(doc) {
      // Try to find main content using common selectors
      let mainContent = doc.querySelector('article, [role="main"], .article, .content, .post, .main');
      
      if (!mainContent) {
        // Fallback: find the element with the most paragraphs
        const allElements = doc.body.querySelectorAll('*');
        let highestParagraphCount = 0;
        
        for (let i = 0; i < allElements.length; i++) {
          const pCount = allElements[i].querySelectorAll('p').length;
          if (pCount > highestParagraphCount && pCount > 2) {
            highestParagraphCount = pCount;
            mainContent = allElements[i];
          }
        }
      }
      
      if (!mainContent) {
        // Final fallback: use body
        mainContent = doc.body;
      }
      
      return mainContent;
    }

    _extractMetadata(doc) {
      // Extract title
      this.articleTitle = doc.title || '';
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content) {
        this.articleTitle = ogTitle.content;
      }

      // Extract byline
      const byline = doc.querySelector('[rel="author"], .author, .byline');
      if (byline) {
        this.articleByline = byline.textContent.trim();
      }

      // Extract excerpt
      const description = doc.querySelector('meta[name="description"], meta[property="og:description"]');
      if (description && description.content) {
        this.articleExcerpt = description.content;
      }

      // Extract site name
      const siteName = doc.querySelector('meta[property="og:site_name"]');
      if (siteName && siteName.content) {
        this.articleSiteName = siteName.content;
      } else {
        this.articleSiteName = doc.domain || '';
      }

      // Extract published time
      const time = doc.querySelector('time[datetime], [itemprop="datePublished"]');
      if (time) {
        this.articlePublishedTime = time.getAttribute('datetime') || time.textContent.trim();
      }
    }

    _processContent(article) {
      // Create a clean container for the content
      const cleanContainer = document.createElement('div');
      
      // Clone the article content
      const articleClone = article.cloneNode(true);
      
      // Clean up the article content
      this._cleanNode(articleClone);
      
      // Remove any remaining unwanted elements
      this._removeUnlikelyCandidates(articleClone);
      
      // Convert to HTML
      cleanContainer.appendChild(articleClone);
      this.articleContent = cleanContainer.innerHTML;
    }

    _cleanNode(node) {
      // Remove empty elements
      const children = node.children;
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        
        // Recursively clean children
        this._cleanNode(child);
        
        // Remove empty elements
        if (!child.textContent.trim() && !child.querySelector('img')) {
          child.remove();
        }
      }
    }
  }

  // 暴露Readability类到全局window对象
  window.Readability = Readability;
})(window);

// reader.js — clean reading mode with readability

(function() {
  // 兼容 Chrome 和 Safari
  const browser = window.chrome || window.safari;
  
  // Run only in top frame
  try { if (window.top !== window.self) return; } catch (_) { return; }
  if (window.__READER_LOADED__) return;
  window.__READER_LOADED__ = true;

  let readerActive = false;
  let originalHtml = null;
  let readerContainer = null;
  let articleData = null;

  // ---- 初始化 readability.js
  function ensureReadability() {
    if (window.Readability) return true;
    try {
      // Readability.js 已内联到文件中
      return !!window.Readability;
    } catch (e) {
      console.error('Readability not loaded:', e);
      return false;
    }
  }

  // ---- 创建阅读器容器
  function createReaderContainer() {
    const container = document.createElement('div');
    container.id = 'reader-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483647;
      background: #f9f9f5;
      padding: 20px;
      overflow-y: auto;
      font-family: 'Georgia', 'Times New Roman', serif;
    `;
    
    // 返回按钮
    const backBtn = document.createElement('button');
    backBtn.id = 'reader-back-btn';
    backBtn.textContent = '← 返回';
    backBtn.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 2147483648;
      background: rgba(0,0,0,0.7);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    backBtn.addEventListener('click', () => toggleReader());
    
    // 内容容器
    const contentWrapper = document.createElement('div');
    contentWrapper.id = 'reader-content';
    contentWrapper.style.cssText = `
      max-width: 700px;
      margin: 0 auto;
      padding: 20px 0;
      line-height: 1.6;
      color: #333;
    `;
    
    container.appendChild(contentWrapper);
    document.body.appendChild(container);
    document.body.appendChild(backBtn);
    
    return { container, contentWrapper, backBtn };
  }

  // ---- 保存原始 HTML
  function saveOriginalHtml() {
    if (!originalHtml) {
      originalHtml = document.documentElement.outerHTML;
    }
  }

  // ---- 应用阅读器模式
  function applyReader() {
    if (!ensureReadability()) {
      showToast('无法加载阅读模式组件');
      return false;
    }

    try {
      saveOriginalHtml();
      
      // 使用 Readability 提取文章内容
      const documentClone = document.cloneNode(true);
      const article = new window.Readability(documentClone).parse();
      
      if (!article) {
        showToast('无法提取文章内容');
        return false;
      }
      
      articleData = article;
      
      // 创建阅读器界面
      const { container, contentWrapper } = createReaderContainer();
      readerContainer = container;
      
      // 设置标题
      if (article.title) {
        const titleEl = document.createElement('h1');
        titleEl.textContent = article.title;
        titleEl.style.cssText = 'font-size: 28px; margin-bottom: 20px; line-height: 1.3;';
        contentWrapper.appendChild(titleEl);
      }
      
      // 设置内容
      contentWrapper.innerHTML += article.content;
      
      // 应用 E-Ink 样式
      applyReaderStyling(contentWrapper);
      
      // 添加页面过滤
      setPageFilter('grayscale(1) contrast(1.2) brightness(1.05)');
      
      readerActive = true;
      showToast('📝 阅读模式已启用');
      
      // 保存状态
      if (window.chrome) {
        chrome.storage?.local?.set?.({ readerActive: true });
      } else if (window.safari) {
        try {
          localStorage.setItem('eink_readerActive', 'true');
        } catch (e) {
          console.error('Error saving reader state:', e);
        }
      }
      
      return true;
    } catch (e) {
      console.error('Reader mode error:', e);
      showToast('阅读模式初始化失败');
      return false;
    }
  }

  // ---- 应用阅读器样式
  function applyReaderStyling(contentWrapper) {
    // 基本样式
    const style = document.createElement('style');
    style.textContent = `
      #reader-content p {
        margin-bottom: 20px;
        font-size: 18px;
      }
      #reader-content h2 {
        font-size: 24px;
        margin: 30px 0 15px;
        font-weight: bold;
      }
      #reader-content h3 {
        font-size: 20px;
        margin: 25px 0 10px;
        font-weight: bold;
      }
      #reader-content img {
        max-width: 100%;
        height: auto;
        margin: 20px 0;
      }
      #reader-content a {
        color: #1a73e8;
        text-decoration: none;
      }
      #reader-content a:hover {
        text-decoration: underline;
      }
    `;
    contentWrapper.appendChild(style);
  }

  // ---- 恢复原始页面
  function restoreOriginal() {
    if (!originalHtml) return;
    
    try {
      // 移除阅读器容器
      if (readerContainer) {
        readerContainer.remove();
        readerContainer = null;
      }
      
      const backBtn = document.getElementById('reader-back-btn');
      if (backBtn) {
        backBtn.remove();
      }
      
      // 清除页面过滤
      clearPageFilter();
      
      readerActive = false;
      showToast('❌ 阅读模式已关闭');
      
      // 保存状态
      if (window.chrome) {
        chrome.storage?.local?.set?.({ readerActive: false });
      } else if (window.safari) {
        try {
          localStorage.setItem('eink_readerActive', 'false');
        } catch (e) {
          console.error('Error saving reader state:', e);
        }
      }
      
    } catch (e) {
      console.error('Error restoring original page:', e);
    }
  }

  // ---- 切换阅读模式
  function toggleReader() {
    if (readerActive) {
      restoreOriginal();
    } else {
      applyReader();
    }
  }

  // ---- 工具函数 (从 content.js 复用)
  function showToast(text) {
    try {
      // 尝试使用 content.js 中的 showToast 函数
      if (window.showEinkToast) {
        window.showEinkToast(text);
        return;
      }
      
      // 自己实现一个简单的 toast
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 2147483648;
        font-size: 14px;
      `;
      toast.textContent = text;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 2000);
    } catch (e) {
      console.error('Toast error:', e);
    }
  }

  function ensureFilterStyle() {
    let filterStyleEl = document.getElementById('eink-filter-style');
    if (!filterStyleEl) {
      filterStyleEl = document.createElement('style');
      filterStyleEl.id = 'eink-filter-style';
      document.documentElement.appendChild(filterStyleEl);
    }
    return filterStyleEl;
  }

  function setPageFilter(filterStr) {
    const el = ensureFilterStyle();
    const css = `:root{filter:${filterStr} !important;-webkit-filter:${filterStr} !important;}`;
    if (el.textContent !== css) el.textContent = css;
  }

  function clearPageFilter() {
    const el = document.getElementById('eink-filter-style');
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // ---- 消息监听
  if (window.chrome) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'toggleReader') {
        const result = toggleReader();
        sendResponse({ success: result, active: readerActive });
        return true;
      }
      if (msg.action === 'isReaderActive') {
        sendResponse({ active: readerActive });
        return true;
      }
    });
  } else if (window.safari) {
    safari.self.addEventListener('message', (event) => {
      if (event.name === 'toggleReader') {
        toggleReader();
      } else if (event.name === 'isReaderActive') {
        safari.self.tab.dispatchMessage('readerActiveResponse', { active: readerActive });
      }
    });
  }

  // ---- 初始化检查
  function init() {
    // 检查是否应该激活阅读器
    if (window.chrome) {
      chrome.storage?.local?.get(['readerActive'], (data) => {
        if (data && data.readerActive) {
          setTimeout(() => applyReader(), 1000);
        }
      });
    } else if (window.safari) {
      try {
        const readerState = localStorage.getItem('eink_readerActive');
        if (readerState === 'true') {
          setTimeout(() => applyReader(), 1000);
        }
      } catch (e) {
        console.error('Error loading reader state:', e);
      }
    }
  }

  // 延迟初始化，确保页面加载完成
  setTimeout(init, 500);

  // 暴露 API 给 content.js
  window.__INKY_READER__ = {
    toggle: toggleReader,
    isActive: () => readerActive
  };

})();
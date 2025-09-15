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
      // readability.js 应该已经在 manifest 中预先加载
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
      background: #f8f5f0;
      padding: 0;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Georgia', 'Times New Roman', serif;
      -webkit-font-smoothing: antialiased;
    `;
    
    // 返回按钮
    const backBtn = document.createElement('button');
    backBtn.id = 'reader-back-btn';
    backBtn.textContent = '← 返回';
    backBtn.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 2147483648;
      background: rgba(0,0,0,0.08);
      color: #333;
      border: 1px solid rgba(0,0,0,0.1);
      padding: 8px 16px;
      border-radius: 18px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
    `;
    backBtn.addEventListener('click', () => toggleReader());
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(0,0,0,0.15)';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'rgba(0,0,0,0.08)';
    });
    
    // 创建内容包装框
    const contentWrapper = document.createElement('div');
    contentWrapper.id = 'reader-content';
    contentWrapper.style.cssText = `
      max-width: 800px;
      margin: 0 auto;
      padding: 60px 40px 100px;
      line-height: 1.7;
      color: #333;
    `;
    
    // 创建内容外部盒子
    const contentBox = document.createElement('div');
    contentBox.id = 'reader-content-box';
    contentBox.style.cssText = `
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      padding: 40px;
      margin-bottom: 40px;
      position: relative;
    `;
    
    // 将原始内容包装在这个盒子里
    const innerContent = document.createElement('div');
    innerContent.id = 'reader-inner-content';
    
    // 组织结构
    contentBox.appendChild(innerContent);
    contentWrapper.appendChild(contentBox);
    container.appendChild(contentWrapper);
    document.body.appendChild(container);
    document.body.appendChild(backBtn);
    
    return { container, contentWrapper, backBtn, innerContent };
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
      
      // 调整页面标题以包含"阅读模式"标识
      const originalTitle = document.title;
      document.title = '📖 ' + originalTitle;
      
      // 使用 Readability 提取文章内容
      const documentClone = document.cloneNode(true);
      const article = new window.Readability(documentClone).parse();
      
      if (!article) {
        showToast('无法提取文章内容');
        return false;
      }
      
      articleData = article;
      
      // 创建阅读器界面
      const { container, contentWrapper, innerContent } = createReaderContainer();
      readerContainer = container;
      
      // 设置标题
      if (article.title) {
        const titleEl = document.createElement('h1');
        titleEl.textContent = article.title;
        innerContent.appendChild(titleEl);
      }
      
      // 添加元信息（作者、发布时间、来源）
      const metaInfo = [];
      if (article.byline) {
        metaInfo.push(article.byline);
      }
      if (article.publishedTime) {
        // 尝试格式化日期
        try {
          const date = new Date(article.publishedTime);
          if (!isNaN(date.getTime())) {
            metaInfo.push(date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }));
          }
        } catch (e) {
          metaInfo.push(article.publishedTime);
        }
      }
      if (article.siteName) {
        metaInfo.push(article.siteName);
      }
      
      // 显示元信息
      if (metaInfo.length > 0) {
        const metaEl = document.createElement('div');
        metaEl.className = 'reader-meta';
        metaEl.textContent = metaInfo.join(' · ');
        innerContent.appendChild(metaEl);
      }
      
      // 设置内容
      innerContent.innerHTML += article.content;
      
      // 应用 Safari 阅读器样式
      applyReaderStyling(contentWrapper);
      
      // 添加柔和的页面过滤，模拟纸张质感
      setPageFilter('contrast(1.05) brightness(1.03)');
      
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
    // Safari风格的文章阅读样式，优化视觉效果
    const style = document.createElement('style');
    style.textContent = `
      /* 全局重置 - 适配新的内容盒子结构 */
      #reader-content *, #reader-inner-content * {
        box-sizing: border-box;
      }
      
      /* 内容盒子样式 */
      #reader-content-box {
        transition: box-shadow 0.3s ease;
      }
      
      #reader-content-box:hover {
        box-shadow: 0 6px 32px rgba(0, 0, 0, 0.12);
      }
      
      /* 标题样式 - 更大更突出 */
      #reader-content h1, #reader-inner-content h1 {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 16px;
        line-height: 1.2;
        color: #1a1a1a;
        letter-spacing: -0.02em;
      }
      
      /* 副标题和元信息 - 更精致的样式 */
      #reader-content .reader-meta, #reader-inner-content .reader-meta {
        color: #666;
        font-size: 15px;
        margin-bottom: 32px;
        line-height: 1.5;
        font-style: italic;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(0,0,0,0.1);
      }
      
      /* 段落样式 - 优化可读性 */
      #reader-content p, #reader-inner-content p {
        margin-bottom: 24px;
        font-size: 18px;
        line-height: 1.8;
        color: #333;
        letter-spacing: 0.01em;
        text-rendering: optimizeLegibility;
      }
      
      /* 二级标题 */
      #reader-content h2, #reader-inner-content h2 {
        font-size: 26px;
        margin: 40px 0 20px;
        font-weight: 600;
        color: #1a1a1a;
        line-height: 1.3;
        letter-spacing: -0.01em;
      }
      
      /* 三级标题 */
      #reader-content h3, #reader-inner-content h3 {
        font-size: 22px;
        margin: 32px 0 16px;
        font-weight: 600;
        color: #1a1a1a;
        line-height: 1.3;
      }
      
      /* 图片样式 - 添加圆角和阴影 */
      #reader-content img, #reader-inner-content img {
        max-width: 100%;
        height: auto;
        margin: 32px auto;
        display: block;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        transition: transform 0.2s ease;
      }
      
      #reader-content img:hover, #reader-inner-content img:hover {
        transform: scale(1.01);
      }
      
      /* 图片说明文字 - 更优雅的排版 */
      #reader-content figcaption, #reader-inner-content figcaption {
        text-align: center;
        color: #666;
        font-size: 15px;
        margin-top: -8px;
        margin-bottom: 24px;
        font-style: italic;
        line-height: 1.6;
      }
      
      /* 链接样式 - 渐变效果和悬停动画 */
      #reader-content a, #reader-inner-content a {
        color: #0066cc;
        text-decoration: none;
        background-image: linear-gradient(to bottom, rgba(0,102,204,0.2) 0%, rgba(0,102,204,0.2) 100%);
        background-size: 100% 1px;
        background-position: 0 100%;
        background-repeat: repeat-x;
        transition: all 0.2s ease;
        padding-bottom: 1px;
      }
      
      #reader-content a:hover, #reader-inner-content a:hover {
        color: #0052a3;
        background-image: linear-gradient(to bottom, rgba(0,102,204,0.4) 0%, rgba(0,102,204,0.4) 100%);
        text-decoration: none;
      }
      
      /* 列表样式 - 更精致的项目符号 */
      #reader-content ul, #reader-content ol, #reader-inner-content ul, #reader-inner-content ol {
        margin: 24px 0;
        padding-left: 1.8em;
      }
      
      #reader-content li, #reader-inner-content li {
        margin-bottom: 12px;
        font-size: 18px;
        line-height: 1.7;
        color: #333;
      }
      
      /* 引用样式 - 更明显的视觉区分 */
      #reader-content blockquote, #reader-inner-content blockquote {
        margin: 32px 0;
        padding: 16px 24px 16px 24px;
        border-left: 3px solid #0066cc;
        color: #555;
        background-color: rgba(0,102,204,0.03);
        border-radius: 0 8px 8px 0;
        font-style: italic;
      }
      
      /* 代码样式 - 更现代的外观 */
      #reader-content pre, #reader-content code, #reader-inner-content pre, #reader-inner-content code {
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 14px;
      }
      
      #reader-content pre, #reader-inner-content pre {
        padding: 20px;
        overflow-x: auto;
        margin: 24px 0;
        background-color: #f5f5f5;
        border-radius: 8px;
        border: 1px solid rgba(0,0,0,0.05);
      }
      
      #reader-content code, #reader-inner-content code {
        background-color: rgba(0,0,0,0.05);
        padding: 2px 4px;
        border-radius: 4px;
        color: #d14;
      }
      
      /* 表格样式 - 更现代的设计 */
      #reader-content table, #reader-inner-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 24px 0;
        font-size: 16px;
      }
      
      #reader-content th, #reader-inner-content th {
        background-color: rgba(0,102,204,0.05);
        font-weight: 600;
        text-align: left;
      }
      
      #reader-content th, #reader-content td, #reader-inner-content th, #reader-inner-content td {
        padding: 12px 16px;
        border: 1px solid #e0e0e0;
      }
      
      #reader-content tr:nth-child(even), #reader-inner-content tr:nth-child(even) {
        background-color: rgba(0,0,0,0.01);
      }
      
      /* 响应式设计 - 更精细的断点控制 */
      @media (max-width: 768px) {
        #reader-content {
          padding: 40px 20px 80px;
          max-width: 100%;
        }
        
        #reader-content-box {
          padding: 20px;
          border-radius: 8px;
        }
        
        #reader-content h1, #reader-inner-content h1 {
          font-size: 28px;
        }
        
        #reader-content h2, #reader-inner-content h2 {
          font-size: 24px;
        }
        
        #reader-content h3, #reader-inner-content h3 {
          font-size: 20px;
        }
        
        #reader-content p, #reader-content li, #reader-inner-content p, #reader-inner-content li {
          font-size: 16px;
          line-height: 1.7;
        }
        
        #reader-content img, #reader-inner-content img {
          border-radius: 4px;
          margin: 24px auto;
        }
      }
      
      /* 打印样式 */
      @media print {
        #reader-back-btn {
          display: none !important;
        }
        
        #reader-container {
          position: relative !important;
          background: white !important;
        }
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
      
      // 恢复原始页面标题
      if (originalHtml) {
        const tempDoc = document.implementation.createHTMLDocument('');
        tempDoc.documentElement.innerHTML = originalHtml;
        document.title = tempDoc.title;
      }
      
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
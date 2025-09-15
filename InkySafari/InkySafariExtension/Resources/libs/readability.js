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
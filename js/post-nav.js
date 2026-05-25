/**
 * Post Navigation Override for Qord's Blog
 * ==========================================
 * Injected via _config.redefine.yml -> inject.footer
 * - Hides original prev/next buttons
 * - Adds three buttons: 返回分类 (left) | 返回标签 (center) | 主页 (right)
 * - Works on both Chinese and English posts
 */

(function() {
  'use strict';

  /* ---- Only on post detail pages ---- */
  if (!document.querySelector('.post-page-container')) return;

  var path = location.pathname;
  var isEn = /\/en\//.test(path) || /\.en\/?$/.test(path);

  /* ---- Hide original prev/next nav ---- */
  if (!document.getElementById('post-nav-styles')) {
    var hideStyle = document.createElement('style');
    hideStyle.id = 'post-nav-styles';
    hideStyle.textContent = '.article-nav { display: none !important; }';
    document.head.appendChild(hideStyle);
  }

  /* ---- Extract category from URL (permalink: :category/:title/) ---- */
  var clean = path.replace(/^\/|\/$/g, '');
  var parts = clean.split('/');
  var catIdx = (parts[0] === 'en') ? 1 : 0;
  var category = parts[catIdx];
  if (!category) return;

  /* ---- Build category page link ---- */
  var catEncoded = encodeURIComponent(decodeURIComponent(category));
  var catHref = isEn
    ? '/en/categories/' + catEncoded + '/'
    : '/categories/' + catEncoded + '/';

  /* ---- Extract first tag from DOM ---- */
  var tagLink = document.querySelector('.article-tags a');
  var tagHref = null;
  var tagName = null;
  if (tagLink) {
    // Use the href from DOM (already correct for zh/en)
    tagHref = tagLink.getAttribute('href');
    // Extract tag name from href (last segment)
    var tagParts = tagLink.getAttribute('href').replace(/^\/|\/$/g, '').split('/');
    tagName = decodeURIComponent(tagParts[tagParts.length - 1]);
  }

  /* ---- Helper: create styled button ---- */
  function makeButton(href, html) {
    var btn = document.createElement('a');
    btn.href = href;
    btn.innerHTML = html;
    btn.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:6px',
      'padding:10px 20px',
      'border-radius:12px',
      'border:1px solid var(--border-color,#e5e7eb)',
      'background:transparent',
      'color:var(--default-text-color,#374151)',
      'text-decoration:none',
      'font-size:14px',
      'font-weight:400',
      'letter-spacing:0.3px',
      'transition:all 0.2s ease'
    ].join(';');
    btn.onmouseenter = function() {
      this.style.borderColor = 'var(--primary-color,#A31F34)';
      this.style.color = 'var(--primary-color,#A31F34)';
      this.style.background = 'var(--background-color,#fff)';
      this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
      this.style.transform = 'translateY(-1px)';
    };
    btn.onmouseout = function() {
      this.style.borderColor = 'var(--border-color,#e5e7eb)';
      this.style.color = 'var(--default-text-color,#374151)';
      this.style.background = 'transparent';
      this.style.boxShadow = 'none';
      this.style.transform = 'none';
    };
    return btn;
  }

  /* ---- Category button (left) ---- */
  var catBtn = makeButton(catHref,
    isEn
      ? '\u2190 Back to <strong>Category</strong>: ' + decodeURIComponent(category)
      : '\u2190 \u8FD4\u56DE<strong>\u5206\u7C7B</strong> ' + decodeURIComponent(category));

  /* ---- Tag button (center), only if tags exist ---- */
  var tagBtn = null;
  if (tagHref && tagName) {
    tagBtn = makeButton(tagHref,
      isEn
        ? '\u2190 Back to <strong>Tag</strong>: ' + tagName
        : '\u2190 \u8FD4\u56DE<strong>\u6807\u7B7E</strong> ' + tagName);
  }

  /* ---- Home button (right) — solid red, matching pagination ---- */
  var homeHref = isEn ? '/en/' : '/';
  var homeBtn = document.createElement('a');
  homeBtn.href = homeHref;
  homeBtn.textContent = isEn ? 'Home' : '\u4E3B\u9875';
  homeBtn.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'min-width:42px',
    'height:42px',
    'padding:0 18px',
    'border-radius:10px',
    'border:1px solid var(--primary-color,#A31F34)',
    'background:var(--primary-color,#A31F34)',
    'color:#fff',
    'font-size:14px',
    'font-weight:500',
    'text-decoration:none',
    'transition:all 0.2s ease'
  ].join(';');
  homeBtn.onmouseenter = function() {
    this.style.opacity = '0.88';
    this.style.boxShadow = '0 2px 8px rgba(163,31,52,0.25)';
  };
  homeBtn.onmouseout = function() {
    this.style.opacity = '1';
    this.style.boxShadow = 'none';
  };

  /* ---- Container: flex layout ---- */
  var wrap = document.createElement('div');
  wrap.className = 'px-2 sm:px-6 md:px-8';
  wrap.style.cssText = [
    'display:flex',
    'align-items:center',
    'margin:24px 0',
    'gap:12px'
  ].join(';');

  // Left group: category + tag
  var leftGroup = document.createElement('div');
  leftGroup.style.cssText = 'display:flex;gap:12px;';
  leftGroup.appendChild(catBtn);
  if (tagBtn) leftGroup.appendChild(tagBtn);

  // Spacer pushes home to right
  var spacer = document.createElement('div');
  spacer.style.cssText = 'flex:1;';

  wrap.appendChild(leftGroup);
  wrap.appendChild(spacer);
  wrap.appendChild(homeBtn);

  /* ---- Insert between copyright box and hidden article-nav ---- */
  var parent = document.querySelector('.article-content-container');
  var navEl = document.querySelector('.article-nav');
  if (parent && navEl) {
    parent.insertBefore(wrap, navEl);
  } else if (parent) {
    parent.appendChild(wrap);
  }
})();

/**
 * Category/Tag Back Button & Pagination Style for Qord's Blog
 * ==========================================
 * Injected via _config.redefine.yml -> inject.footer
 * - Adds elegant back button on category/tag detail pages (zh & en)
 * - Overrides pagination with refined minimal style
 */

(function() {
  'use strict';

  var path = location.pathname;
  var isEn = /\/en\//.test(path);

  // Match category/tag detail pages for both zh and en
  var catPattern = /^(\/en)?\/categories\/.+/;
  var tagPattern = /^(\/en)?\/tags\/.+/;
  var catIndex = /^(\/en)?\/categories\/?$/;
  var tagIndex = /^(\/en)?\/tags\/?$/;

  var isCat = catPattern.test(path) && !catIndex.test(path);
  var isTag = tagPattern.test(path) && !tagIndex.test(path);

  /* ---- Inject elegant pagination CSS ---- */
  if (!document.getElementById('back-btn-pagination-styles')) {
    var pagStyle = document.createElement('style');
    pagStyle.id = 'back-btn-pagination-styles';
    pagStyle.textContent = [
      '/* Pagination: refined minimal style */',
      '.paginator {',
      '  font-size: 0.92rem !important;',
      '  margin-top: 40px !important;',
      '}',
      '.paginator a.page-number,',
      '.paginator span.page-number,',
      '.paginator a.prev,',
      '.paginator a.next {',
      '  display: inline-flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  min-width: 42px !important;',
      '  height: 42px !important;',
      '  padding: 0 14px !important;',
      '  border-radius: 10px !important;',
      '  border: 1px solid var(--border-color, #e5e7eb) !important;',
      '  background: transparent !important;',
      '  color: var(--default-text-color, #374151) !important;',
      '  font-weight: 400 !important;',
      '  text-decoration: none !important;',
      '  box-shadow: none !important;',
      '}',
      '.paginator a.page-number:hover,',
      '.paginator a.prev:hover,',
      '.paginator a.next:hover {',
      '  border-color: var(--primary-color, #A31F34) !important;',
      '  color: var(--primary-color, #A31F34) !important;',
      '  background: transparent !important;',
      '  transform: none !important;',
      '  box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;',
      '}',
      '.paginator a.page-number:active,',
      '.paginator a.prev:active,',
      '.paginator a.next:active {',
      '  transform: scale(0.96) !important;',
      '}',
      '.paginator span.current {',
      '  min-width: 42px !important;',
      '  height: 42px !important;',
      '  padding: 0 14px !important;',
      '  border-radius: 10px !important;',
      '  border: 1px solid var(--primary-color, #A31F34) !important;',
      '  background: var(--primary-color, #A31F34) !important;',
      '  color: #fff !important;',
      '  font-weight: 500 !important;',
      '}',
      '.paginator i.fa-regular,',
      '.paginator i.fas,',
      '.paginator i.far {',
      '  color: var(--default-text-color, #6b7280) !important;',
      '  font-size: 0.85em !important;',
      '}',
      '.paginator .extend:hover i.fa-regular,',
      '.paginator .extend:hover i.fas,',
      '.paginator .extend:hover i.far {',
      '  color: var(--primary-color, #A31F34) !important;',
      '}',
    ].join('\n');
    document.head.appendChild(pagStyle);
  }

  /* ---- Back Button (only on detail pages) ---- */
  if (!isCat && !isTag) return;

  var btn = document.createElement('a');
  btn.href = isCat
    ? (isEn ? '/en/categories/' : '/categories/')
    : (isEn ? '/en/tags/' : '/tags/');

  btn.textContent = isEn
    ? ('\u2190 Back to ' + (isCat ? 'Categories' : 'Tags'))
    : ('\u2190 \u8FD4\u56DE' + (isCat ? '\u5206\u7C7B' : '\u6807\u7B7E') + '\u9875');

  btn.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:6px',
    'margin:24px auto 8px',
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

  var container = document.querySelector('.post-list-container') ||
    document.querySelector('.main-content') ||
    document.querySelector('main');

  if (container) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;';
    wrap.appendChild(btn);
    container.appendChild(wrap);
  }
})();

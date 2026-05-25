/**
 * Category/Tag Back Button for Qord's Blog
 * ==========================================
 * Adds a "← 返回分类/标签页" button on category/tag detail pages.
 */

(function() {
  'use strict';

  var path = location.pathname;
  var isCat = /^\/categories\/.+/.test(path) && path !== '/categories/';
  var isTag = /^\/tags\/.+/.test(path) && path !== '/tags/';
  if (!isCat && !isTag) return;

  var btn = document.createElement('a');
  btn.href = isCat ? '/categories/' : '/tags/';
  btn.textContent = '← 返回' + (isCat ? '分类' : '标签') + '页';
  btn.style.cssText = [
    'display:inline-block',
    'margin:20px auto',
    'padding:8px 16px',
    'border-radius:8px',
    'background:var(--primary-color,#A31F34)',
    'color:#fff',
    'text-decoration:none',
    'font-size:14px'
  ].join(';');

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

/**
 * Navigation Buttons for Qord's Blog
 * ==========================================
 * Injected via _config.redefine.yml → inject.footer
 *
 * Part A: Pagination styling + category/tag back button
 * Part B: Post detail navigation (返回分类/标签/主页)
 */

(function() {
  'use strict';
  var path = location.pathname;

  /* ================================================================
     Part A — Category/Tag Detail: Back Button + Pagination Styles
     ================================================================ */
  var catPat = /^(\/en)?\/categories\/.+/;
  var tagPat = /^(\/en)?\/tags\/.+/;
  var catIdx = /^(\/en)?\/categories\/?$/;
  var tagIdx = /^(\/en)?\/tags\/?$/;
  var isCat = catPat.test(path) && !catIdx.test(path);
  var isTag = tagPat.test(path) && !tagIdx.test(path);
  var isEnA = /\/en\//.test(path);

  /* ---- Pagination CSS ---- */
  if (!document.getElementById('nav-pagination-styles')) {
    var ps = document.createElement('style');
    ps.id = 'nav-pagination-styles';
    ps.textContent = [
      '.paginator{font-size:.92rem!important;margin-top:40px!important}',
      '.paginator a.page-number,.paginator span.page-number,.paginator a.prev,.paginator a.next{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:42px!important;height:42px!important;padding:0 14px!important;border-radius:10px!important;border:1px solid var(--border-color,#e5e7eb)!important;background:transparent!important;color:var(--default-text-color,#374151)!important;font-weight:400!important;text-decoration:none!important;box-shadow:none!important}',
      '.paginator a.page-number:hover,.paginator a.prev:hover,.paginator a.next:hover{border-color:var(--primary-color,#A31F34)!important;color:var(--primary-color,#A31F34)!important;background:transparent!important;transform:none!important;box-shadow:0 1px 3px rgba(0,0,0,.06)!important}',
      '.paginator a.page-number:active,.paginator a.prev:active,.paginator a.next:active{transform:scale(.96)!important}',
      '.paginator span.current{min-width:42px!important;height:42px!important;padding:0 14px!important;border-radius:10px!important;border:1px solid var(--primary-color,#A31F34)!important;background:var(--primary-color,#A31F34)!important;color:#fff!important;font-weight:500!important}',
      '.paginator i.fa-regular,.paginator i.fas,.paginator i.far{color:var(--default-text-color,#6b7280)!important;font-size:.85em!important}',
      '.paginator .extend:hover i.fa-regular,.paginator .extend:hover i.fas,.paginator .extend:hover i.far{color:var(--primary-color,#A31F34)!important}'
    ].join('\n');
    document.head.appendChild(ps);
  }

  /* ---- Back Button ---- */
  if (isCat || isTag) {
    var b = document.createElement('a');
    b.href = isCat ? (isEnA ? '/en/categories/' : '/categories/') : (isEnA ? '/en/tags/' : '/tags/');
    b.textContent = isEnA ? ('\u2190 Back to ' + (isCat ? 'Categories' : 'Tags')) : ('\u2190 ' + (isCat ? '\u8FD4\u56DE\u5206\u7C7B\u9875' : '\u8FD4\u56DE\u6807\u7B7E\u9875'));
    b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin:24px auto 8px;padding:10px 20px;border-radius:12px;border:1px solid var(--border-color,#e5e7eb);background:transparent;color:var(--default-text-color,#374151);text-decoration:none;font-size:14px;font-weight:400;letter-spacing:.3px;transition:all .2s ease';
    b.onmouseenter = function(){this.style.borderColor='var(--primary-color,#A31F34)';this.style.color='var(--primary-color,#A31F34)';this.style.background='var(--background-color,#fff)';this.style.boxShadow='0 2px 8px rgba(0,0,0,.06)';this.style.transform='translateY(-1px)'};
    b.onmouseout = function(){this.style.borderColor='var(--border-color,#e5e7eb)';this.style.color='var(--default-text-color,#374151)';this.style.background='transparent';this.style.boxShadow='none';this.style.transform='none'};
    var c = document.querySelector('.post-list-container') || document.querySelector('.main-content') || document.querySelector('main');
    if (c) { var w = document.createElement('div'); w.style.cssText = 'text-align:center'; w.appendChild(b); c.appendChild(w); }
  }

  /* ================================================================
     Part B — Post Detail: 返回分类/标签 + 主页
     ================================================================ */
  if (!document.querySelector('.post-page-container')) return;

  var isEnB = /\/en\//.test(path) || /\.en\/?$/.test(path);

  /* Hide original prev/next */
  if (!document.getElementById('post-nav-styles')) {
    var hs = document.createElement('style');
    hs.id = 'post-nav-styles';
    hs.textContent = '.article-nav{display:none!important}';
    document.head.appendChild(hs);
  }

  /* Extract category from URL */
  var parts = path.replace(/^\/|\/$/g,'').split('/');
  var catName = decodeURIComponent(parts[parts[0]==='en'?1:0]);
  if (!catName) return;
  var catHref = '/categories/' + encodeURIComponent(catName) + '/';
  if (isEnB) catHref = '/en' + catHref;

  /* Extract tag from DOM */
  var tl = document.querySelector('.article-tags a');
  var tagHref = tl ? tl.getAttribute('href') : null;
  var tagName = null;
  if (tagHref) {
    var tagSeg = tagHref.replace(/^\/|\/$/g,'').split('/');
    // last non-empty segment is the tag name
    for (var i = tagSeg.length - 1; i >= 0; i--) {
      if (tagSeg[i]) { tagName = decodeURIComponent(tagSeg[i]); break; }
    }
  }

  /* Button factory */
  function mk(href, html) {
    var btn = document.createElement('a');
    btn.href = href;
    btn.innerHTML = html;
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:12px;border:1px solid var(--border-color,#e5e7eb);background:transparent;color:var(--default-text-color,#374151);text-decoration:none;font-size:14px;font-weight:400;letter-spacing:.3px;transition:all .2s ease';
    btn.onmouseenter = function(){this.style.borderColor='var(--primary-color,#A31F34)';this.style.color='var(--primary-color,#A31F34)';this.style.background='var(--background-color,#fff)';this.style.boxShadow='0 2px 8px rgba(0,0,0,.06)';this.style.transform='translateY(-1px)'};
    btn.onmouseout = function(){this.style.borderColor='var(--border-color,#e5e7eb)';this.style.color='var(--default-text-color,#374151)';this.style.background='transparent';this.style.boxShadow='none';this.style.transform='none'};
    return btn;
  }

  /* Category button */
  var catBtn = mk(catHref, isEnB ? '\u2190 Back to <strong>Category</strong>: ' + catName : '\u2190 \u8FD4\u56DE<strong>\u5206\u7C7B</strong> ' + catName);

  /* Tag button */
  var tagBtn = null;
  if (tagHref && tagName)
    tagBtn = mk(tagHref, isEnB ? '\u2190 Back to <strong>Tag</strong>: ' + tagName : '\u2190 \u8FD4\u56DE<strong>\u6807\u7B7E</strong> ' + tagName);

  /* Home button (solid red) */
  var homeBtn = document.createElement('a');
  homeBtn.href = isEnB ? '/en/' : '/';
  homeBtn.textContent = isEnB ? 'Home' : '\u4E3B\u9875';
  homeBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:42px;padding:0 18px;border-radius:10px;border:1px solid var(--primary-color,#A31F34);background:var(--primary-color,#A31F34);color:#fff;font-size:14px;font-weight:500;text-decoration:none;transition:all .2s ease';
  homeBtn.onmouseenter = function(){this.style.opacity='.88';this.style.boxShadow='0 2px 8px rgba(163,31,52,.25)'};
  homeBtn.onmouseout = function(){this.style.opacity='1';this.style.boxShadow='none'};

  /* Layout */
  var wrap = document.createElement('div');
  wrap.className = 'px-2 sm:px-6 md:px-8';
  wrap.style.cssText = 'display:flex;align-items:center;margin:24px 0;gap:12px';

  var left = document.createElement('div');
  left.style.cssText = 'display:flex;gap:12px';
  left.appendChild(catBtn);
  if (tagBtn) left.appendChild(tagBtn);

  var sp = document.createElement('div');
  sp.style.cssText = 'flex:1';

  wrap.appendChild(left);
  wrap.appendChild(sp);
  wrap.appendChild(homeBtn);

  var parent = document.querySelector('.article-content-container');
  var nav = document.querySelector('.article-nav');
  if (parent && nav) parent.insertBefore(wrap, nav);
  else if (parent) parent.appendChild(wrap);
})();

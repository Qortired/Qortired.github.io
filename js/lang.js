/**
 * Language Switcher & Settings Button for Qord's Blog
 * ==========================================
 * Injected via _config.redefine.yml → inject.footer
 * - Language switch button (top-right)
 * - Settings/cog button (next to language switch)
 * - English page: text replacements, relative time, subtitle
 */

(function() {
  'use strict';

  var path = location.pathname;
  var isEn = /\/en\//.test(path) || /\.en\/?$/.test(path);

  /* ========================================
     Inject global styles (unconditionally)
     ======================================== */
  if (!document.getElementById('lang-switch-styles')) {
    var gStyle = document.createElement('style');
    gStyle.id = 'lang-switch-styles';
    gStyle.textContent = [
      '/* Lang button: navbar shrink sync */',
      '.navbar-shrink .lang-switch-btn {',
      '  top: 10px !important; padding: 4px 12px !important;',
      '  font-size: 12px !important; border-radius: 16px !important;',
      '}',
      '/* Lang button: mobile */',
      '@media (max-width: 768px) {',
      '  .lang-switch-btn {',
      '    top: 18px !important; right: 58px !important;',
      '    padding: 4px 10px !important; font-size: 11px !important;',
      '    letter-spacing: 0 !important; border-radius: 14px !important;',
      '  }',
      '}',
      '/* Settings button: navbar shrink sync */',
      '.navbar-shrink .settings-btn {',
      '  top: 10px !important; width: 34px !important; height: 34px !important;',
      '  font-size: 13px !important; border-radius: 16px !important;',
      '}',
      '/* Settings button: mobile */',
      '@media (max-width: 768px) {',
      '  .settings-btn {',
      '    top: 18px !important; right: 112px !important;',
      '    width: 28px !important; height: 28px !important; font-size: 11px !important;',
      '  }',
      '}',
      '/* Hide category/tag count */',
      '.cat-count-hidden { display: none !important; }'
    ].join('\n');
    document.head.appendChild(gStyle);
  }

  /* ========================================
     Language Switch Button
     ======================================== */

  /* Smart language switch: stay on same page in other language */
  function getLangSwitchPath() {
    var p = location.pathname;
    if (isEn) return p.replace(/^\/en/, '').replace(/\.en(\/?)$/, '$1');
    if (p === '/') return '/en/';
    if (/^\/(categories|tags)(\/|$)/.test(p)) return '/en' + p;
    return p.replace(/\/$/, '') + '.en/';
  }

  var btnHref = getLangSwitchPath();

  var btn = document.querySelector('.lang-switch-btn');
  if (btn) {
    btn.href = btnHref;
    btn.textContent = isEn ? '中文' : 'EN';
  } else {
    btn = document.createElement('a');
    btn.className = 'lang-switch-btn';
    btn.href = btnHref;
    btn.textContent = isEn ? '中文' : 'EN';
    document.body.appendChild(btn);
  }
  btn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;padding:6px 14px;border-radius:20px;background:transparent;border:1px solid var(--second-text-color,#666);color:var(--second-text-color,#666);text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.5px;backdrop-filter:blur(4px);transition:all 0.2s ease';
  btn.onmouseenter = function() {
    this.style.color='#fff';this.style.background='var(--primary-color,#A31F34)';this.style.borderColor='var(--primary-color,#A31F34)';
  };
  btn.onmouseout = function() {
    this.style.color='var(--second-text-color,#666)';this.style.background='transparent';this.style.borderColor='var(--second-text-color,#666)';
  };

  /* ========================================
     Settings Button — keep in DOM, fix to top-right
     ======================================== */
  (function fixGear() {
    var gear = document.querySelector('.toggle-tools-list');
    if (!gear) { setTimeout(fixGear, 50); return; }

    // Hide other side-tools (keep gear visible)
    var ct = document.querySelector('.right-side-tools-container');
    if (ct) {
      var siblings = ct.querySelectorAll('.right-bottom-tools:not(.toggle-tools-list)');
      for (var i = 0; i < siblings.length; i++) siblings[i].style.display = 'none';
    }

    // Fix gear to top-right with clean styles
    gear.classList.add('settings-btn');
    gear.style.cssText = [
      'position:fixed',
      'top:20px',
      'right:78px',
      'z-index:9999',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'width:40px',
      'height:40px',
      'border-radius:20px',
      'background:transparent',
      'border:1px solid var(--second-text-color,#666)',
      'color:var(--second-text-color,#666)',
      'cursor:pointer',
      'font-size:16px',
      'margin:0',
      'box-shadow:none',
      'transition:color 0.2s ease, background 0.2s ease, border-color 0.2s ease'
    ].join(';');
    gear.onmouseenter = function() {
      this.style.color='#fff';this.style.background='var(--primary-color,#A31F34)';this.style.borderColor='var(--primary-color,#A31F34)';
    };
    gear.onmouseleave = function() {
      this.style.color='var(--second-text-color,#666)';this.style.background='transparent';this.style.borderColor='var(--second-text-color,#666)';
    };
  })();

  /* ========================================
     English Page Features
     ======================================== */
  if (!isEn) return;

  function replaceTextKeepChildren(el, from, to) {
    if (!el) return;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) n.textContent = n.textContent.replace(from, to);
  }

  function replaceTitles() {
    replaceTextKeepChildren(document.querySelector('.logo-title'), /Qord的Blog/g, 'Qord Blog');
    var desc = document.querySelector('.home-banner-container .description');
    if (desc) {
      for (var i = 0; i < desc.childNodes.length; i++)
        if (desc.childNodes[i].nodeType === 3)
          desc.childNodes[i].textContent = desc.childNodes[i].textContent.replace(/Qord的Blog/g, 'Qord Blog');
    }
  }

  function fixNavLinks() {
    var links = document.querySelectorAll('a[href^="/"]:not([href^="/en/"]):not(.lang-switch-btn)');
    var pat = /^\/(categories|tags|archives)\//;
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href');
      if (h && (h === '/' || pat.test(h))) links[i].setAttribute('href', '/en' + h);
    }
  }

  function fixEnglishRelativeTime() {
    var dates = document.querySelectorAll('.home-article-meta-info .home-article-date');
    if (!dates.length) return;
    var engAgo = {
      second: '%s second%s ago', minute: '%s minute%s ago', hour: '%s hour%s ago',
      day: '%s day%s ago', week: '%s week%s ago', month: '%s month%s ago', year: '%s year%s ago'
    };
    var pl = function(n, s) { return s.replace('%s', n).replace('%s', n > 1 ? 's' : ''); };
    for (var i = 0; i < dates.length; i++) {
      var el = dates[i], raw = el.getAttribute('data-date');
      if (!raw) continue;
      var diff = Math.floor((Date.now() - new Date(raw.split(' GMT')[0]).getTime()) / 1000);
      var y = Math.floor(diff / 2592000 / 12), mo = Math.floor(diff / 2592000),
          w = Math.floor(diff / 86400 / 7), d = Math.floor(diff / 86400),
          h = Math.floor(diff / 3600 % 24), mi = Math.floor(diff / 60 % 60), s = Math.floor(diff % 60);
      el.textContent = y>0 ? pl(y, engAgo.year) : mo>0 ? pl(mo, engAgo.month) :
        w>0 ? pl(w, engAgo.week) : d>0 ? pl(d, engAgo.day) :
        h>0 ? pl(h, engAgo.hour) : mi>0 ? pl(mi, engAgo.minute) :
        s>0 ? pl(s, engAgo.second) : '';
    }
  }

  requestAnimationFrame(function() {
    replaceTitles(); fixNavLinks(); fixEnglishRelativeTime();
    setTimeout(function() { replaceTitles(); fixNavLinks(); fixEnglishRelativeTime(); }, 1000);
  });

  /* English subtitle: Typed.js */
  var initEnSubtitle = function() {
    var sub = document.getElementById('subtitle');
    if (!sub) return;
    sub.textContent = '';
    new window.Typed('#subtitle', {
      strings: ['Games Notes'], typeSpeed: 100, backSpeed: 80, backDelay: 1500,
      loop: false, startDelay: 500, smartBackspace: false, showCursor: true
    });
  };
  var check = setInterval(function() {
    if (window.Typed) { clearInterval(check); initEnSubtitle(); }
  }, 100);
  setTimeout(function() { clearInterval(check); }, 10000);

})();

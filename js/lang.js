/**
 * Language Switcher for Qord's Blog
 * ==========================================
 * Injected via _config.redefine.yml → inject.footer
 * 
 * Features:
 * - Fixed EN/中文 toggle button (top-right)
 * - English page: replace Chinese titles with English text
 * - English page: initialize Typed.js subtitle animation
 */

(function() {
  'use strict';

  var isEn = /\/en\//.test(location.pathname) || /\.en\/?$/.test(location.pathname);

  /* ---- Smart language switch: stay on same page in other language ---- */
  function getLangSwitchPath() {
    var p = location.pathname;
    if (isEn) {
      // English → Chinese: remove /en/ prefix and .en suffix
      return p.replace(/^\/en/, '').replace(/\.en(\/?)$/, '$1');
    }
    // Chinese → English
    if (p === '/') return '/en/';
    // Category/tag pages → prepend /en
    if (/^\/(categories|tags)(\/|$)/.test(p)) return '/en' + p;
    // Article posts → append .en suffix before trailing slash
    return p.replace(/\/$/, '') + '.en/';
  }

  var langSwitchHref = getLangSwitchPath();

  /* ---- Language Switcher Button ---- */
  var btn = document.querySelector('.lang-switch-btn');
  if (btn) {
    // Update existing button for current language
    btn.href = langSwitchHref;
    btn.textContent = isEn ? '中文' : 'EN';
    // Re-apply base styles (in case they were lost)
    btn.style.cssText = [
      'position:fixed',
      'top:20px',
      'right:20px',
      'z-index:9999',
      'padding:6px 14px',
      'border-radius:20px',
      'background:transparent',
      'border:1px solid var(--second-text-color,#666)',
      'color:var(--second-text-color,#666)',
      'text-decoration:none',
      'font-size:13px',
      'font-weight:500',
      'letter-spacing:0.5px',
      'backdrop-filter:blur(4px)',
      'transition:all 0.2s ease'
    ].join(';');
    btn.onmouseenter = function() {
      this.style.color = '#fff';
      this.style.background = 'var(--primary-color,#A31F34)';
      this.style.borderColor = 'var(--primary-color,#A31F34)';
    };
    btn.onmouseout = function() {
      this.style.color = 'var(--second-text-color,#666)';
      this.style.background = 'transparent';
      this.style.borderColor = 'var(--second-text-color,#666)';
    };
  } else {
    // Create new button
    btn = document.createElement('a');
    btn.className = 'lang-switch-btn';
    btn.href = langSwitchHref;
    btn.textContent = isEn ? '中文' : 'EN';
    btn.style.cssText = [
      'position:fixed',
      'top:20px',
      'right:20px',
      'z-index:9999',
      'padding:6px 14px',
      'border-radius:20px',
      'background:transparent',
      'border:1px solid var(--second-text-color,#666)',
      'color:var(--second-text-color,#666)',
      'text-decoration:none',
      'font-size:13px',
      'font-weight:500',
      'letter-spacing:0.5px',
      'backdrop-filter:blur(4px)',
      'transition:all 0.2s ease'
    ].join(';');
    btn.onmouseenter = function() {
      this.style.color = '#fff';
      this.style.background = 'var(--primary-color,#A31F34)';
      this.style.borderColor = 'var(--primary-color,#A31F34)';
    };
    btn.onmouseout = function() {
      this.style.color = 'var(--second-text-color,#666)';
      this.style.background = 'transparent';
      this.style.borderColor = 'var(--second-text-color,#666)';
    };
    document.body.appendChild(btn);

    // Inject responsive styles for mobile + hide category count
    if (!document.getElementById('lang-switch-styles')) {
      var style = document.createElement('style');
      style.id = 'lang-switch-styles';
      style.textContent = [
        '/* Desktop: navbar shrink sync */',
        '.navbar-shrink .lang-switch-btn {',
        '  top: 10px !important;',
        '  padding: 4px 12px !important;',
        '  font-size: 12px !important;',
        '  border-radius: 16px !important;',
        '}',
        '/* Mobile */',
        '@media (max-width: 768px) {',
        '  .lang-switch-btn {',
        '    top: 18px !important;',
        '    right: 58px !important;',
        '    padding: 4px 10px !important;',
        '    font-size: 11px !important;',
        '    letter-spacing: 0 !important;',
        '    border-radius: 14px !important;',
        '  }',
        '}',
        '/* Hide category/tag count numbers */',
        '.cat-count-hidden { display: none !important; }'
      ].join('\n');
      document.head.appendChild(style);
    }
  }

  /* ---- English Page: Text Replacements ---- */
  if (!isEn) return;

  // Utility: replace text in element, keeping child elements intact
  function replaceTextKeepChildren(el, from, to) {
    if (!el) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      node.textContent = node.textContent.replace(from, to);
    }
  }

  // Replace navbar logo title + banner title
  function replaceTitles() {
    var logo = document.querySelector('.logo-title');
    replaceTextKeepChildren(logo, /Qord的Blog/g, 'Qord Blog');

    var desc = document.querySelector('.home-banner-container .description');
    if (desc) {
      // Only replace direct text nodes (not inside <p> or <i>)
      for (var i = 0; i < desc.childNodes.length; i++) {
        var node = desc.childNodes[i];
        if (node.nodeType === 3) { // TEXT_NODE
          node.textContent = node.textContent.replace(/Qord的Blog/g, 'Qord Blog');
        }
      }
    }
  }

  // Fix navbar links: prepend /en/ to keep user on English pages
  // Also fixes category/tag/archive detail links on content pages
  function fixNavLinks() {
    var links = document.querySelectorAll('a[href^="/"]:not([href^="/en/"]):not(.lang-switch-btn)');
    var enPattern = /^\/(categories|tags|archives)\//; // matches /categories/..., /tags/..., /archives/...
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href) continue;
      // Fix nav menu items + category/tag/archive detail links
      if (href === '/' || enPattern.test(href)) {
        links[i].setAttribute('href', '/en' + href);
      }
    }
  }

  // Fix English relative time (theme hardcodes zh-CN ago strings)
  function fixEnglishRelativeTime() {
    var dates = document.querySelectorAll('.home-article-meta-info .home-article-date');
    if (!dates.length) return;
    var engAgo = {
      second: '%s second%s ago',
      minute: '%s minute%s ago',
      hour:   '%s hour%s ago',
      day:    '%s day%s ago',
      week:   '%s week%s ago',
      month:  '%s month%s ago',
      year:   '%s year%s ago'
    };
    var plural = function(n, s) { return s.replace('%s', n).replace('%s', n > 1 ? 's' : ''); };
    for (var i = 0; i < dates.length; i++) {
      var el = dates[i];
      var raw = el.getAttribute('data-date');
      if (!raw) continue;
      var postMs = new Date(raw.split(' GMT')[0]).getTime();
      var diff = Math.floor((Date.now() - postMs) / 1000);
      var y = Math.floor(diff / 2592000 / 12),
          mo = Math.floor(diff / 2592000),
          w = Math.floor(diff / 86400 / 7),
          d = Math.floor(diff / 86400),
          h = Math.floor(diff / 3600 % 24),
          mi = Math.floor(diff / 60 % 60),
          s = Math.floor(diff % 60);
      var val = y>0 ? plural(y, engAgo.year) : mo>0 ? plural(mo, engAgo.month) :
                w>0 ? plural(w, engAgo.week) : d>0 ? plural(d, engAgo.day) :
                h>0 ? plural(h, engAgo.hour) : mi>0 ? plural(mi, engAgo.minute) :
                s>0 ? plural(s, engAgo.second) : '';
      el.textContent = val;
    }
  }
  requestAnimationFrame(function() {
    replaceTitles();
    fixNavLinks();
    fixEnglishRelativeTime();
    setTimeout(function() {
      replaceTitles();
      fixNavLinks();
      fixEnglishRelativeTime();
    }, 1000);
  });

  /* ---- English Subtitle: Typed.js Animation ---- */
  var initEnSubtitle = function() {
    var sub = document.getElementById('subtitle');
    if (!sub) return;
    sub.textContent = '';
    new window.Typed('#subtitle', {
      strings: ['Games Notes'],
      typeSpeed: 100,
      backSpeed: 80,
      backDelay: 1500,
      loop: false,
      startDelay: 500,
      smartBackspace: false,
      showCursor: true
    });
  };

  // Typed.js loads after inject.footer → poll until available
  var check = setInterval(function() {
    if (window.Typed) {
      clearInterval(check);
      initEnSubtitle();
    }
  }, 100);
  setTimeout(function() { clearInterval(check); }, 10000); // safety timeout

})();

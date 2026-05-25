/**
 * Language Switcher + Beijing Clock for Qord's Blog
 * ==========================================
 * Injected via _config.redefine.yml → inject.footer
 *
 * Features:
 * - Fixed EN/中文 toggle (top-right, smart stay-on-page switch)
 * - English page: titles, relative time, subtitle, nav links
 * - Footer: live Beijing Time clock (UTC+8)
 */

(function() {
  'use strict';

  var path = location.pathname;
  var isEn = /\/en\//.test(path) || /\.en\/?$/.test(path);

  /* ---- Inject shared styles ---- */
  if (!document.getElementById('lang-switch-styles')) {
    var s = document.createElement('style');
    s.id = 'lang-switch-styles';
    s.textContent = [
      '.navbar-shrink .lang-switch-btn { top:10px!important;padding:4px 12px!important;font-size:12px!important;border-radius:16px!important }',
      '@media(max-width:768px){.lang-switch-btn{top:18px!important;right:58px!important;padding:4px 10px!important;font-size:11px!important;letter-spacing:0!important;border-radius:14px!important}}',
      '.cat-count-hidden{display:none!important}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---- Language Switch Button ---- */
  function getLangSwitchPath() {
    var p = path;
    if (isEn) return p.replace(/^\/en/, '').replace(/\.en(\/?)$/, '$1');
    if (p === '/') return '/en/';
    if (/^\/(categories|tags)(\/|$)/.test(p)) return '/en' + p;
    return p.replace(/\/$/, '') + '.en/';
  }

  var btn = document.querySelector('.lang-switch-btn');
  if (!btn) {
    btn = document.createElement('a');
    btn.className = 'lang-switch-btn';
    document.body.appendChild(btn);
  }
  btn.href = getLangSwitchPath();
  btn.textContent = isEn ? '中文' : 'EN';
  btn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;padding:6px 14px;border-radius:20px;background:transparent;border:1px solid var(--second-text-color,#666);color:var(--second-text-color,#666);text-decoration:none;font-size:13px;font-weight:500;letter-spacing:.5px;backdrop-filter:blur(4px);transition:all .2s ease';
  btn.onmouseenter = function(){this.style.color='#fff';this.style.background='var(--primary-color,#A31F34)';this.style.borderColor='var(--primary-color,#A31F34)'};
  btn.onmouseout = function(){this.style.color='var(--second-text-color,#666)';this.style.background='transparent';this.style.borderColor='var(--second-text-color,#666)'};

  /* ---- Beijing Time Clock (footer) ---- */
  var clk = document.createElement('div');
  clk.id = 'beijing-time';
  clk.style.cssText = 'text-align:center;margin-top:4px;font-size:14px;color:var(--third-text-color,#999);font-variant-numeric:tabular-nums';
  var ft = document.querySelector('.footer .info-container');
  if (ft) {
    var cr = ft.querySelector('.text-center');
    if (cr) cr.parentNode.insertBefore(clk, cr.nextSibling);
    else ft.appendChild(clk);
    function tick() {
      var d = new Date();
      var bj = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 28800000);
      clk.textContent = (isEn ? 'Beijing Time: ' : '\u5F53\u524D\u5317\u4EAC\u65F6\u95F4: ') +
        String(bj.getHours()).padStart(2,'0') + ':' +
        String(bj.getMinutes()).padStart(2,'0') + ':' +
        String(bj.getSeconds()).padStart(2,'0') + ' (UTC+8)';
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---- English Page Features ---- */
  if (!isEn) return;

  function replaceTextKeepChildren(el, from, to) {
    if (!el) return;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) n.textContent = n.textContent.replace(from, to);
  }

  function replaceTitles() {
    replaceTextKeepChildren(document.querySelector('.logo-title'), /Qord\u7684Blog/g, 'Qord Blog');
    var desc = document.querySelector('.home-banner-container .description');
    if (desc) for (var i = 0; i < desc.childNodes.length; i++)
      if (desc.childNodes[i].nodeType === 3)
        desc.childNodes[i].textContent = desc.childNodes[i].textContent.replace(/Qord\u7684Blog/g, 'Qord Blog');
  }

  function replacePageTitle() {
    var t = document.title;
    t = t.replace(/Qord\u7684Blog/g, 'Qord Blog');
    t = t.replace(/\u8BB0\u5F55\u6E38\u620F\u5165\u5751\u7B14\u8BB0/g, 'Games Notes');
    t = t.replace(/\u5206\u7C7B/g, 'Categories');
    t = t.replace(/\u6807\u7B7E/g, 'Tags');
    document.title = t;
  }

  function fixNavLinks() {
    var ls = document.querySelectorAll('a[href^="/"]:not([href^="/en/"]):not(.lang-switch-btn)');
    var pat = /^\/(categories|tags|archives)\//;
    for (var i = 0; i < ls.length; i++) {
      var h = ls[i].getAttribute('href');
      if (h && (h === '/' || pat.test(h))) ls[i].setAttribute('href', '/en' + h);
    }
  }

  function fixEnglishRelativeTime() {
    var ds = document.querySelectorAll('.home-article-meta-info .home-article-date');
    if (!ds.length) return;
    var ago = {second:'%s second%s ago',minute:'%s minute%s ago',hour:'%s hour%s ago',day:'%s day%s ago',week:'%s week%s ago',month:'%s month%s ago',year:'%s year%s ago'};
    var pl = function(n,s){return s.replace('%s',n).replace('%s',n>1?'s':'')};
    for (var i = 0; i < ds.length; i++) {
      var el = ds[i], raw = el.getAttribute('data-date');
      if (!raw) continue;
      var d = Math.floor((Date.now() - new Date(raw.split(' GMT')[0]).getTime()) / 1000);
      var y=Math.floor(d/31104000),mo=Math.floor(d/2592000),w=Math.floor(d/604800),dd=Math.floor(d/86400),h=Math.floor(d/3600%24),mi=Math.floor(d/60%60),s1=Math.floor(d%60);
      el.textContent = y>0?pl(y,ago.year):mo>0?pl(mo,ago.month):w>0?pl(w,ago.week):dd>0?pl(dd,ago.day):h>0?pl(h,ago.hour):mi>0?pl(mi,ago.minute):s1>0?pl(s1,ago.second):'';
    }
  }

  requestAnimationFrame(function(){
    replacePageTitle();replaceTitles();fixNavLinks();fixEnglishRelativeTime();
    setTimeout(function(){replacePageTitle();replaceTitles();fixNavLinks();fixEnglishRelativeTime()},1000);
  });

  var initSub = function(){
    var sub = document.getElementById('subtitle');
    if (!sub) return;
    sub.textContent = '';
    new window.Typed('#subtitle',{strings:['Games Notes'],typeSpeed:100,backSpeed:80,backDelay:1500,loop:false,startDelay:500,smartBackspace:false,showCursor:true});
  };
  var chk = setInterval(function(){if(window.Typed){clearInterval(chk);initSub()}},100);
  setTimeout(function(){clearInterval(chk)},10000);
})();

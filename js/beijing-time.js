/**
 * Beijing Time Clock for Qord's Blog
 * ==========================================
 * Injected via _config.redefine.yml → inject.footer
 * Replaces the old runtime counter with live Beijing time.
 * Supports Chinese & English i18n.
 */

(function() {
  'use strict';

  var isEn = /\/en\//.test(location.pathname) || /\.en\/?$/.test(location.pathname);

  /* ---- Create clock element ---- */
  var clockDiv = document.createElement('div');
  clockDiv.id = 'beijing-time';
  clockDiv.style.cssText = [
    'text-align:center',
    'margin-top:4px',
    'font-size:14px',
    'color:var(--third-text-color,#999)',
    'font-variant-numeric:tabular-nums'
  ].join(';');

  /* ---- Find insertion point: after copyright line ---- */
  var footer = document.querySelector('.footer .info-container');
  if (!footer) return;

  var copyrightEl = footer.querySelector('.text-center');
  if (copyrightEl) {
    copyrightEl.parentNode.insertBefore(clockDiv, copyrightEl.nextSibling);
  } else {
    footer.appendChild(clockDiv);
  }

  /* ---- Update Beijing time every second ---- */
  function updateClock() {
    var now = new Date();
    // Convert local time to UTC+8 (Beijing)
    var utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    var bjMs = utcMs + 8 * 3600000;
    var bj = new Date(bjMs);
    var h = String(bj.getHours()).padStart(2, '0');
    var m = String(bj.getMinutes()).padStart(2, '0');
    var s = String(bj.getSeconds()).padStart(2, '0');
    clockDiv.textContent = (isEn ? 'Beijing Time: ' : '当前北京时间: ') + h + ':' + m + ':' + s + ' (UTC+8)';
  }

  updateClock();
  setInterval(updateClock, 1000);
})();

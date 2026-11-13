/*  MileHigh Recover pixel  v0.4 (2026-11-13, owner approved): click tracking (the text and destination of the link or
 *  button clicked, and which part of the page it is in; never anything typed into a form). One visitor across sites:
 *  links to hosts listed in data-link-hosts carry mhr_vid, and the receiving site adopts it when it has no id yet.
 *  data-notice="1" makes the script show its own cookie notice (for sites with no banner of their own, like Wix).
 *  v0.3 (2026-11-03, owner decision): notice mode. Visitors are tracked unless they click
 *  No thanks or send Global Privacy Control. Visitors in a Pacific timezone (possible California) are opt in:
 *  nothing is sent until they click Okay.
 *  v0.2 (2026-11-03: location via recover.milehigh.systems/c, plus timezone,
 *  device type, first touch source and trip details from the page's own search fields)
 *  Install: <script src="https://api.milehigh.systems/recover.js" data-key="YOUR_PIXEL_KEY" defer></script>
 *
 *  Rules this script enforces, on purpose:
 *   1. No thanks (cookie mhr_consent=0) stops everything, for good. Pacific timezone visitors send nothing
 *      until they click Okay (mhr_consent=1). Everyone else is tracked with a visible notice.
 *   2. Global Privacy Control (navigator.globalPrivacyControl) is honored as a hard opt out.
 *   3. The only identifier we create is a random first party id in a cookie we own.
 *      No fingerprinting, no reading other cookies, no form scraping.
 *   4. We send: our visitor id, page path, timestamp, browser timezone, phone/tablet/desktop, how they
 *      arrived (utm_source or referring site, first visit only) and trip details already in the URL
 *      (dates, guests, pets, room). Coarse location (state, city) is added by our edge proxy; the IP is not kept.
 */
(function () {
  'use strict';
  var s = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  })();
  var KEY = s && s.getAttribute('data-key');
  var ENDPOINT = (s && s.getAttribute('data-endpoint')) || 'https://recover.milehigh.systems/c';
  var LINK_HOSTS = ((s && s.getAttribute('data-link-hosts')) || '').toLowerCase().split(/\s+/).filter(Boolean);
  var NOTICE = s && s.getAttribute('data-notice') === '1';
  var DETAILS = (s && s.getAttribute('data-details')) || 'https://roadhouse.milehigh.systems/terms#cookies';
  if (!KEY) return;

  // Hard opt out: Global Privacy Control.
  if (navigator.globalPrivacyControl === true) return;

  // A recovery email link carries ?r=<send id>. Remember it so the booking can be attributed
  // even on a different device or after cookies were cleared.
  var rm = location.search.match(/[?&]r=([0-9a-f-]{36})/i);
  if (rm) { try { document.cookie = 'mhr_ref=' + rm[1] + '; max-age=1209600; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {} }

  function getCookie(name) {
    var m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value, days) {
    var d = new Date(); d.setTime(d.getTime() + days * 864e5);
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '');
  }
  // v0.4: a link from our other site carries ?mhr_vid=<id>. Take it as our id when we have none yet (so one person is one
  // visitor across both sites); if we already have a different id, remember the other one so the two can be joined.
  // The parameter is removed from the address bar so a shared link never carries someone else's id.
  var fromVid = null;
  (function () {
    var m = location.search.match(/[?&]mhr_vid=([0-9a-f]{32})(?=&|$)/i);
    if (!m) return;
    if (!getCookie('mhr_vid')) setCookie('mhr_vid', m[1].toLowerCase(), 365);
    else if (getCookie('mhr_vid') !== m[1].toLowerCase()) fromVid = m[1].toLowerCase();
    try {
      var u = new URL(location.href); u.searchParams.delete('mhr_vid');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  })();
  function optInRequired() {
    try { return /^America\/(Los_Angeles|Tijuana)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) { return true; }
  }
  function hasConsent() {
    var c = getCookie('mhr_consent');
    if (c === '0' || window.mhrConsent === false) return false;
    if (c === '1' || window.mhrConsent === true) return true;
    return !optInRequired();
  }
  function visitorId() {
    var v = getCookie('mhr_vid');
    if (!v) {
      var a = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(a);
      v = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      setCookie('mhr_vid', v, 365);
    }
    return v;
  }
  function isBookingPage() {
    var p = location.pathname.toLowerCase();
    var hints = ['/book', '/reserve', '/reservation', '/checkout', '/booking', '/availability', '/room', '/payment'];
    for (var i = 0; i < hints.length; i++) if (p.indexOf(hints[i]) === 0 || p.indexOf(hints[i] + '/') > -1) return true;
    return !!document.querySelector('[data-mhr-booking]');
  }
  function device() {
    var w = Math.min(screen.width || 0, window.innerWidth || 9999);
    if (/iPad|Tablet/i.test(navigator.userAgent) || (w >= 600 && w < 1024 && 'ontouchstart' in window)) return 'tablet';
    return (/Mobi|Android|iPhone/i.test(navigator.userAgent) || w < 600) ? 'phone' : 'desktop';
  }
  // First touch: utm_source, else the referring site, else direct. Kept 30 days so later visits keep it.
  function source() {
    var q = new URLSearchParams(location.search), src = q.get('utm_source');
    if (src) src = src + (q.get('utm_medium') ? ' / ' + q.get('utm_medium') : '') + (q.get('utm_campaign') ? ' / ' + q.get('utm_campaign') : '');
    else if (document.referrer) { try { var h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h !== location.hostname) src = h; } catch (e) {} }
    var have = getCookie('mhr_src');
    if (!have) { have = src || 'direct'; setCookie('mhr_src', have, 30); setCookie('mhr_land', location.pathname, 30); }
    return have;
  }
  function trip() {
    var q = new URLSearchParams(location.search), t = {};
    ['checkIn', 'checkOut', 'guests', 'pets', 'roomId'].forEach(function (k) { var v = q.get(k); if (v && v.length < 20) t[k] = v; });
    var m = location.pathname.match(/^\/room\/(\d+)/); if (m) t.roomId = m[1];
    return Object.keys(t).length ? t : null;
  }
  function ctx() {
    var tz = null; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    return { tz: tz, device: device(), source: source(), landing: getCookie('mhr_land'), trip: trip(), mode: getCookie('mhr_consent') === '1' ? 'opt_in' : 'notice' };
  }
  function send(kind, extra) {
    if (!hasConsent()) return;
    var body = JSON.stringify({
      key: KEY,
      vid: visitorId(),
      kind: kind,
      path: location.pathname,
      ref: document.referrer ? document.referrer.split('?')[0] : null,
      ts: new Date().toISOString(),
      ref_send: getCookie('mhr_ref'),
      ctx: ctx(),
      meta: extra || {}
    });
    if (navigator.sendBeacon) {
      // text/plain avoids a CORS preflight, which sendBeacon cannot perform.
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
    } else {
      var x = new XMLHttpRequest();
      x.open('POST', ENDPOINT, true);
      x.setRequestHeader('Content-Type', 'text/plain');
      x.send(body);
    }
  }

  // Public API the site's consent banner calls.
  window.MHRecover = {
    consent: function () {
      var already = hasConsent();
      setCookie('mhr_consent', '1', 365);
      window.mhrConsent = true;
      send('consent');
      if (!already) track();
    },
    mode: function () { return optInRequired() ? 'opt_in' : 'notice'; },
    revoke: function () {
      setCookie('mhr_consent', '0', 365);
      window.mhrConsent = false;
    },
    bookingStarted: function (meta) { send('booking_started', meta); },
    booked: function (meta) { send('booked', meta); },
    // First party email capture: the email a guest types at checkout, sent once per address.
    // Same consent rule as everything else (nothing is sent after No thanks or GPC).
    identify: function (email, firstName) {
      email = String(email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || window.mhrIdentified === email) return;
      window.mhrIdentified = email;
      send('identify', { email: email, first_name: firstName || null });
    }
  };

  function track() {
    var meta = null;
    if (fromVid) { meta = { from_vid: fromVid }; fromVid = null; }
    send(isBookingPage() ? 'booking_page' : 'pageview', meta);
  }

  // v0.4 clicks. Links and buttons only. We keep the visible label, where a link goes (no query string) and which part
  // of the page it is in. Inputs, selects and text areas are never read.
  var lastClick = { el: null, t: 0 };
  function label(el) {
    var t = el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || '';
    if (!t) { var img = el.querySelector && el.querySelector('img[alt]'); if (img) t = img.getAttribute('alt'); }
    return String(t).replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  function dest(el) {
    var h = el.getAttribute && el.getAttribute('href');
    if (!h) return null;
    if (/^(tel|mailto|sms):/i.test(h)) return h.slice(0, 120);
    try { var u = new URL(h, location.href); return (u.host === location.host ? '' : u.protocol + '//' + u.host) + u.pathname + (u.hash && u.hash.length < 40 ? u.hash : ''); } catch (e) { return null; }
  }
  function area(el) {
    var a = el.closest('[data-mhr-area]'); if (a) return a.getAttribute('data-mhr-area');
    var l = el.closest('header,nav,footer,form,aside,dialog,[role=dialog]');
    return l ? (l.getAttribute('role') || l.tagName.toLowerCase()) : 'main';
  }
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest && ev.target.closest('a,button,[role=button],input[type=submit],input[type=button],summary');
    if (!el || el.closest('#mhr-banner')) return;
    var now = Date.now();
    if (lastClick.el === el && now - lastClick.t < 800) return;
    lastClick = { el: el, t: now };
    // Carry our id to our other site so the visit continues as the same person.
    if (el.tagName === 'A' && LINK_HOSTS.length && hasConsent()) {
      try {
        var u = new URL(el.getAttribute('href'), location.href);
        if (LINK_HOSTS.indexOf(u.hostname.toLowerCase()) > -1) { u.searchParams.set('mhr_vid', visitorId()); el.setAttribute('href', u.toString()); }
      } catch (e) {}
    }
    send('click', { text: label(el), href: dest(el), el: el.tagName.toLowerCase(), area: area(el) });
  }, true);

  // v0.4 own notice, only when the page asks for it (data-notice="1") and has not been answered on this site.
  function showNotice() {
    if (!NOTICE || getCookie('mhr_banner') === '1' || getCookie('mhr_consent') === '0') return;
    var optIn = optInRequired();
    var b = document.createElement('div');
    b.id = 'mhr-banner';
    b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Cookie notice');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#0D2123;color:#F5F1E8;font:13px/1.4 Montserrat,system-ui,sans-serif;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;box-shadow:0 -2px 8px rgba(0,0,0,.2)';
    var txt = document.createElement('span');
    txt.appendChild(document.createTextNode(optIn ? 'May we use cookies to see how visitors use our site and help you book? ' : 'We use cookies to see how visitors use our site and help you book. '));
    var a = document.createElement('a'); a.href = DETAILS; a.target = '_blank'; a.rel = 'noopener'; a.style.color = 'inherit'; a.textContent = 'Details';
    txt.appendChild(a);
    var yes = document.createElement('button'), no = document.createElement('button');
    yes.textContent = optIn ? 'Okay' : 'Got it'; no.textContent = 'No thanks';
    yes.style.cssText = 'background:#F5F1E8;color:#0D2123;border:0;padding:6px 14px;border-radius:999px;font:inherit;font-weight:700;cursor:pointer';
    no.style.cssText = 'background:transparent;color:#F5F1E8;border:1px solid rgba(245,241,232,.6);padding:6px 14px;border-radius:999px;font:inherit;cursor:pointer';
    function done() { b.remove(); setCookie('mhr_banner', '1', 365); }
    yes.onclick = function () { if (optIn) window.MHRecover.consent(); done(); };
    no.onclick = function () { window.MHRecover.revoke(); done(); };
    var btns = document.createElement('span'); btns.style.cssText = 'display:flex;gap:8px'; btns.appendChild(yes); btns.appendChild(no);
    b.appendChild(txt); b.appendChild(btns);
    (document.body || document.documentElement).appendChild(b);
  }
  if (document.body) showNotice(); else document.addEventListener('DOMContentLoaded', showNotice);

  // Single page apps change routes without a page load. Hook history so each route counts.
  var lastPath = location.pathname;
  function onRoute() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    track();
  }
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () { var r = orig.apply(this, arguments); setTimeout(onRoute, 0); return r; };
  });
  window.addEventListener('popstate', onRoute);

  if (hasConsent()) track();
})();

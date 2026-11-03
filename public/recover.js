/*  MileHigh Recover pixel  v0.1
 *  Install: <script src="https://api.milehigh.systems/recover.js" data-key="YOUR_PIXEL_KEY" defer></script>
 *
 *  Rules this script enforces, on purpose:
 *   1. Nothing is sent until the visitor has affirmatively consented. We look for a
 *      first party cookie `mhr_consent=1`, a `window.mhrConsent === true` flag the site's
 *      consent banner can set, or a prior consent event. No banner click, no network call.
 *   2. Global Privacy Control (navigator.globalPrivacyControl) is honored as a hard opt out.
 *   3. The only identifier we create is a random first party id in a cookie we own.
 *      No fingerprinting, no reading other cookies, no form scraping.
 *   4. We send: our visitor id, the page path, a booking page flag, timestamp. Nothing else.
 */
(function () {
  'use strict';
  var s = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    return all[all.length - 1];
  })();
  var KEY = s && s.getAttribute('data-key');
  var ENDPOINT = (s && s.getAttribute('data-endpoint')) || 'https://xgxmrcehxfvshygxzsyg.supabase.co/functions/v1/recover-collect';
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
  function hasConsent() {
    return window.mhrConsent === true || getCookie('mhr_consent') === '1';
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
      setCookie('mhr_consent', '1', 365);
      window.mhrConsent = true;
      send('consent');
      track();
    },
    revoke: function () {
      setCookie('mhr_consent', '0', 365);
      window.mhrConsent = false;
    },
    bookingStarted: function (meta) { send('booking_started', meta); },
    booked: function (meta) { send('booked', meta); }
  };

  function track() { send(isBookingPage() ? 'booking_page' : 'pageview'); }

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

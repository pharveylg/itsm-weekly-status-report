/**
 * dispatch-runner.html — upload once to SiteAssets on the OGRP site.
 *
 * Why it exists: the studio can't write to SharePoint REST from its own origin
 * (cross-origin / sandboxed-iframe blocks), but a page SERVED BY SharePoint can,
 * using the visitor's own SSO session. The studio opens this page in a popup and
 * hands it the payload via postMessage; this page does the queue write and
 * reports the result back. No IT change, no DLP conflict, no console needed.
 */
export const DISPATCH_RUNNER_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>ITSM Dispatch Runner</title>
</head>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a241e;color:#d6f3df;font-family:'Segoe UI',Arial,sans-serif;">
<div style="text-align:center;max-width:420px;padding:24px;">
  <div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#43c463;margin-bottom:12px;">ITSM Dispatch Runner</div>
  <div id="msg" style="font-size:14px;line-height:1.6;">Waiting for the studio…</div>
  <div style="margin-top:16px;font-size:11px;color:#6f9384;">You can close this window once it shows ✓.</div>
</div>
<script>
(function () {
  var msg = document.getElementById('msg');
  var ALLOWED = [
    window.location.origin,
    'https://itsmstudio.z13.web.core.windows.net',
    'https://ingrammicro.sharepoint.com'
  ];
  function isAllowed(origin) {
    if (!origin) return false;
    if (ALLOWED.indexOf(origin) !== -1) return true;
    return /^https:\\/\\/[a-z0-9-]+\\.ingrammicro\\.(?:sharepoint|com)/.test(origin);
  }
  function report(type, data) {
    try { if (window.opener) window.opener.postMessage({ type: type, data: data }, '*'); } catch (e) { /* ignore */ }
  }
  window.addEventListener('message', function (e) {
    if (!e || !e.origin || !isAllowed(e.origin)) return;
    if (e.data && e.data.type === 'itsm-dispatch') write(e.data.payload);
  });
  report('itsm-runner-ready');

  async function write(p) {
    msg.textContent = 'Writing dispatch ticket to the queue…';
    try {
      var web = (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) || window.location.origin;
      var digest = await fetch(web + '/_api/contextinfo', { method: 'POST', headers: { Accept: 'application/json;odata=verbose' } })
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.d.GetContextWebInformation.FormDigestValue; });
      var et = await fetch(web + "/_api/web/lists/getbytitle('ITSM_Dispatch_Queue')/ListItemEntityTypeFullName", { headers: { Accept: 'application/json;odata=verbose' } })
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.d.ListItemEntityTypeFullName; });
      var res = await fetch(web + "/_api/web/lists/getbytitle('ITSM_Dispatch_Queue')/items", {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest },
        body: JSON.stringify({ __metadata: { type: et }, Title: p.reportWeek, Payload: JSON.stringify(p) })
      });
      if (res.ok) {
        msg.textContent = '✓ Dispatched — Flow B is firing. You can close this window.';
        msg.style.color = '#43c463';
        report('itsm-dispatch-done');
      } else {
        var err = await res.json().catch(function () { return null; });
        var detail = err && err.error ? String(err.error.message.value).slice(0, 140) : '';
        msg.textContent = '✗ HTTP ' + res.status + (detail ? ' — ' + detail : '');
        msg.style.color = '#ff9d9d';
        report('itsm-dispatch-error', res.status);
      }
    } catch (e) {
      msg.textContent = '✗ ' + e;
      msg.style.color = '#ff9d9d';
      report('itsm-dispatch-error', String(e));
    }
  }
})();
</script>
</body>
</html>
`;

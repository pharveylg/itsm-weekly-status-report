import React, { useState } from 'react';
import { SHAREPOINT_PNP_SCRIPT } from '../data/powerAutomateWorkflow';
import { OGRP_SITE, DISPATCH_QUEUE_LIST, WEEKLY_UPDATES_LIST } from '../data/sharepointConfig';
import { DISPATCH_RUNNER_HTML } from '../data/dispatchRunner';
import { FlowCardFormData, RagStatus, activeItems, completedItems } from '../types/itsm';
import { ragDot } from '../utils/rag-ui';
import { BrandLockup } from './BrandLockup';
import { Terminal, Copy, Check, Mail, Layers, Table, Zap, FileWarning } from 'lucide-react';


interface Props {
  formData: FlowCardFormData;
  overall: RagStatus;
  queueStatus: 'unknown' | 'checking' | 'ok' | 'missing' | 'blocked';
  onVerifyQueue: () => void;
  recipient: string;
  setRecipient: (url: string) => void;
}

// Creates the ITSM_Dispatch_Queue list + Payload column. Flow B wakes on
// "When an item is created" here — SharePoint-only, so it sails through DLP.
const QUEUE_SNIPPET = `(async function () {
  var web = (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) || "${OGRP_SITE}";
  var digest = await fetch(web + "/_api/contextinfo", { method: "POST", headers: { Accept: "application/json;odata=verbose" } }).then(function (r) { return r.json(); }).then(function (d) { return d.d.GetContextWebInformation.FormDigestValue; });
  var mk = await fetch(web + "/_api/web/lists", { method: "POST", headers: { Accept: "application/json;odata=verbose", "Content-Type": "application/json;odata=verbose", "X-RequestDigest": digest }, body: JSON.stringify({ __metadata: { type: "SP.List" }, Title: "${DISPATCH_QUEUE_LIST}", BaseTemplate: 100, Description: "Dispatch tickets written by the ITSM Studio. Flow B fires when an item appears." }) });
  if (!mk.ok && mk.status !== 400) { console.log("\\u2717 list: HTTP " + mk.status); return; }
  console.log(mk.status === 400 ? "\\u00b7 queue list already exists" : "\\u2713 queue list created");
  var f = await fetch(web + "/_api/web/lists/getbytitle('${DISPATCH_QUEUE_LIST}')/fields", { method: "POST", headers: { Accept: "application/json;odata=verbose", "Content-Type": "application/json;odata=verbose", "X-RequestDigest": digest }, body: JSON.stringify({ __metadata: { type: "SP.FieldMultiLineText" }, Title: "Payload", FieldTypeKind: 3, RichText: false, NumberOfLines: 20 }) });
  console.log(f.ok ? "\\u2713 Payload column added" : "\\u00b7 Payload: HTTP " + f.status);
  console.log("Now hit 'Verify dispatch queue' in the studio.");
})();`;

// Paste into the browser console on any page of the OGRP site — reads the list
// schema straight from the logged-in SSO session, no PowerShell required.
const VERIFY_SNIPPET = `var site = "${OGRP_SITE.replace(/^https:\/\/[^/]+/, '')}";
fetch(site + "/_api/web/lists/getbytitle('${WEEKLY_UPDATES_LIST}')/fields?$select=Title,InternalName,TypeAsString&$filter=Hidden eq false", { headers: { Accept: "application/json" } }).then(r => r.json()).then(d => console.table(d.value.map(f => ({ Title: f.Title, Internal: f.InternalName, Type: f.TypeAsString }))))`;

// No-PowerShell provisioning: creates the list (if missing) and its columns through
// the browser's SSO session (REST + form digest). Idempotent — existing list/columns
// are reported, not duplicated. Does NOT touch "ITSM Service Delivery" — that library
// only holds the generated .docx file Flow B writes; this list is its metadata row.
const PROVISION_SNIPPET = `(async function () {
  var site = "${OGRP_SITE.replace(/^https:\/\/[^/]+/, '')}";
  var list = "${WEEKLY_UPDATES_LIST}";
  var digest = await fetch(site + "/_api/contextinfo", { method: "POST", headers: { Accept: "application/json;odata=verbose" } }).then(function (r) { return r.json(); }).then(function (d) { return d.d.GetContextWebInformation.FormDigestValue; });
  var mk = await fetch(site + "/_api/web/lists", { method: "POST", headers: { Accept: "application/json;odata=verbose", "Content-Type": "application/json;odata=verbose", "X-RequestDigest": digest }, body: JSON.stringify({ __metadata: { type: "SP.List" }, Title: list, BaseTemplate: 100, Description: "System of record — one row per finalized week, written by Flow B." }) });
  console.log(mk.ok ? "✓ list created" : mk.status === 400 ? "· list already exists" : "✗ list: HTTP " + mk.status);
  var base = site + "/_api/web/lists/getbytitle('" + list + "')/fields";
  var post = function (body) { return fetch(base, { method: "POST", headers: { Accept: "application/json;odata=verbose", "Content-Type": "application/json;odata=verbose", "X-RequestDigest": digest }, body: JSON.stringify(body) }); };
  var cols = [
    { Title: "Items_JSON", FieldTypeKind: 3 },
    { Title: "Completed_Snapshot", FieldTypeKind: 3 },
    { Title: "Priorities_Snapshot", FieldTypeKind: 3 },
    { Title: "Metrics_JSON", FieldTypeKind: 3 },
    { Title: "Metrics_Analysis", FieldTypeKind: 3 },
    { Title: "Major_Incidents", FieldTypeKind: 9 },
    { Title: "Alert_Detection", FieldTypeKind: 9 },
    { Title: "Window_Closed_At", FieldTypeKind: 4 },
    { Title: "Report_Doc_Url", FieldTypeKind: 11 },
    { Title: "RAG_Status", FieldTypeKind: 6, Choices: { results: ["Green", "Yellow", "Red"] } }
  ];
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i];
    var meta = c.FieldTypeKind === 6 ? "SP.FieldChoice" : "SP.Field";
    var body = Object.assign({ __metadata: { type: meta } }, c);
    var res = await post(body);
    if (res.ok) { console.log("✓ " + c.Title + " created"); }
    else { var e = await res.json().catch(function () { return null; }); console.log("· " + c.Title + " — " + (res.status === 400 ? "already exists or invalid" : "HTTP " + res.status) + (e && e.error ? ": " + String(e.error.message.value).slice(0, 90) : "")); }
  }
  console.log("Done. Refresh the List Settings page — the ten columns should now appear under Columns.");
})();`;

const EXPECTED_COLS = [
  'Items_JSON · Note', 'Completed_Snapshot · Note', 'Priorities_Snapshot · Note',
  'RAG_Status · Choice (Green/Yellow/Red)', 'Major_Incidents · Number', 'Alert_Detection · Number',
  'Window_Closed_At · DateTime', 'Metrics_JSON · Note', 'Metrics_Analysis · Note', 'Report_Doc_Url · URL',
];

const COLUMNS = [
  { name: 'Title', type: 'Single Line Text', desc: 'Report week (e.g. Week of Jul 13, 2026)' },
  { name: 'Items_JSON', type: 'Multiple Lines of Text', desc: 'Round-trippable source of truth — next Monday’s seed is read from here' },
  { name: 'Completed_Snapshot', type: 'Multiple Lines of Text', desc: 'Human / Power-BI readable Section 1 snapshot' },
  { name: 'Priorities_Snapshot', type: 'Multiple Lines of Text', desc: 'Human / Power-BI readable Section 2 snapshot' },
  { name: 'RAG_Status', type: 'Choice (Green / Yellow / Red)', desc: 'Overall — WRITTEN BY FLOW (auto), never manual' },
  { name: 'Metrics_JSON', type: 'Multiple Lines of Text', desc: 'All six KPIs: target / MTD / last / this / auto RAG / auto trend' },
  { name: 'Metrics_Analysis', type: 'Multiple Lines of Text', desc: 'The consolidated Remarks read across all KPIs (committed on Done)' },
  { name: 'Major_Incidents', type: 'Number', desc: 'Quick KPI captured from the card' },
  { name: 'Alert_Detection', type: 'Number', desc: 'Quick KPI captured from the card' },
  { name: 'Window_Closed_At', type: 'Date / Time', desc: 'Timestamp when the Mon 07:00 window finalized' },
  { name: 'Report_Doc_Url', type: 'Hyperlink', desc: 'Link to the generated .docx in ITSM Service Delivery' },
];

export const M365ConnectionKit: React.FC<Props> = ({ formData, overall, queueStatus, onVerifyQueue, recipient, setRecipient }) => {
  const [copiedPnp, setCopiedPnp] = useState(false);
  const handleCopyPnp = () => { navigator.clipboard.writeText(SHAREPOINT_PNP_SCRIPT); setCopiedPnp(true); setTimeout(() => setCopiedPnp(false), 2500); };
  const [copiedVerify, setCopiedVerify] = useState(false);
  const copyVerify = () => { navigator.clipboard.writeText(VERIFY_SNIPPET); setCopiedVerify(true); setTimeout(() => setCopiedVerify(false), 2000); };
  const [copiedProv, setCopiedProv] = useState(false);
  const copyProv = () => { navigator.clipboard.writeText(PROVISION_SNIPPET); setCopiedProv(true); setTimeout(() => setCopiedProv(false), 2000); };
  const [copiedQueue, setCopiedQueue] = useState(false);
  const copyQueue = () => { navigator.clipboard.writeText(QUEUE_SNIPPET); setCopiedQueue(true); setTimeout(() => setCopiedQueue(false), 2000); };
  const downloadRunner = () => {
    const blob = new Blob([DISPATCH_RUNNER_HTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dispatch-runner.html'; a.click();
    URL.revokeObjectURL(url);
  };

  const live = queueStatus === 'ok';

  const comp = completedItems(formData.items);
  const act = activeItems(formData.items);
  const ragBanner = overall === 'green' ? 'bg-ok-soft border-ok text-ok-deep' : overall === 'yellow' ? 'bg-warn-soft border-warn text-warn-deep' : overall === 'red' ? 'bg-crit-soft border-crit text-crit-deep' : 'bg-xv-soft border-xv text-xv-deep';

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="stripes panel-soft p-8 sm:p-10 relative overflow-hidden reveal">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand to-brand-deep" />
        <div className="relative z-10 flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line/70">
          <BrandLockup />
          <span className="text-[10px] font-mono text-ink-soft bg-white/70 border border-line rounded px-2 py-1">Microsoft 365 · connection kit</span>
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/80 border border-line text-[11px] font-bold font-mono text-brand-deep uppercase tracking-wider"><Layers className="w-3.5 h-3.5 text-brand" /> Architecture Hub</span>
              <span className="text-xs text-ink-soft font-mono flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ok dot-live" /> SharePoint · Teams · Outlook</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight leading-tight">Wire the weekly lifecycle to your M365 tenant</h2>
            <p className="text-sm text-ink-soft leading-relaxed max-w-xl">Provision the list with one command, connect three services, and the flow round-trips the item array every Monday — writing the auto RAG and the closure timestamp on finalize.</p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono text-ink-soft uppercase tracking-widest">Connections</span>
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-white to-tech-soft border-2 border-tech/40 flex items-center justify-center shadow-xl shadow-tech/15">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-tech to-navy flex items-center justify-center shadow-lg"><Layers className="w-6 h-6 text-white" /></div>
            </div>
            <span className="text-base font-extrabold font-display text-tech tracking-wide">3 / 3</span>
            <span className="text-[10px] font-mono text-ink-soft lowercase">services ready</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left */}
        <div className="lg:col-span-7 space-y-5">
          {/* SharePoint-hosted dispatch queue */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-line flex-wrap">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand" />
                <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">
                  Dispatch Queue · SharePoint live mode
                </h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                live ? 'bg-brand-soft text-brand-deep border-brand/40'
                : queueStatus === 'missing' ? 'bg-crit-soft text-crit-deep border-crit/40'
                : queueStatus === 'blocked' ? 'bg-warn-soft text-warn-deep border-warn/40'
                : 'bg-xv-soft text-xv-deep border-xv/40'
              }`}>
                {live ? '🟢 LIVE' : queueStatus === 'checking' ? 'CHECKING…' : queueStatus === 'missing' ? 'QUEUE MISSING' : queueStatus === 'blocked' ? 'UNREACHABLE' : '⚪ SANDBOX'}
              </span>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed font-body">
              This studio is meant to run <strong className="text-ink">from inside the OGRP SharePoint site</strong> (embedded on a modern page), so every write to <code className="text-tech">ITSM_Dispatch_Queue</code> is same-origin and uses your own SSO session automatically. Flow B fires on each new item and does the file + email. Run the snippet once to provision the list, then Verify.
            </p>
            <div className="relative">
              <pre className="p-3 pr-14 rounded-lg bg-navy text-[10.5px] text-[#bcd0f0] overflow-x-auto scrollbar-thin leading-relaxed font-mono max-h-56">{QUEUE_SNIPPET}</pre>
              <button onClick={copyQueue} className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold font-mono bg-navy-soft hover:bg-brand text-on-navy hover:text-white border border-navy-line transition active:scale-95">
                {copiedQueue ? <><Check className="w-3 h-3 text-ok" /> Copied</> : <><Copy className="w-3 h-3 text-brand-bright" /> Copy</>}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={onVerifyQueue} disabled={queueStatus === 'checking'}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold font-display bg-gradient-to-r from-brand to-brand-bright hover:from-brand-deep hover:to-brand text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition active:scale-[0.98] disabled:opacity-50">
                {queueStatus === 'checking' ? 'Checking…' : live ? 'Re-verify queue' : 'Verify dispatch queue'}
              </button>
              {queueStatus === 'missing' && (
                <span className="text-[11px] text-crit-deep font-body">Queue list not found — run the provisioning snippet below once, then Verify again.</span>
              )}
              {queueStatus === 'blocked' && (
                <span className="text-[11px] text-warn-deep font-body">Couldn’t reach SharePoint from this browser (cross-origin) — the studio isn’t being served from the OGRP site. Open it from the embedded SharePoint page, or use the dispatch runner fallback below.</span>
              )}
            </div>
            <div className="space-y-1.5 pt-3 border-t border-line">
              <label className="block text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider">Send-to · Outlook To: line</label>
              <input
                type="email"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="recipient@ingrammicro.com"
                className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-soft/40 focus:ring-2 focus:ring-brand font-mono focus:border-brand"
              />
              <p className="text-[10px] text-ink-soft font-mono leading-relaxed">
                The digest previews (here + the Sent Artifacts tab) use this address. Keep it matching the <span className="text-brand-deep">To:</span> field of every <span className="text-brand-deep">Send an email (V2)</span> action in your flow. While testing, point it at one mailbox (you) — never the leadership list.
              </p>
            </div>
          </div>

          {/* Cross-origin fallback — the popup runner writes with its own SSO instead of this page's */}
          <div className={`panel p-6 space-y-4 ${queueStatus === 'blocked' ? 'ring-2 ring-warn/40' : ''}`}>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-line flex-wrap">
              <div className="flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-warn" />
                <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">Fallback · dispatch runner popup</h3>
              </div>
              {queueStatus === 'blocked' && <span className="text-[10px] font-mono text-warn-deep bg-warn-soft border border-warn/40 rounded px-2 py-0.5">use this now</span>}
            </div>
            <p className="text-xs text-ink-soft leading-relaxed font-body">
              If the queue stays <strong className="text-ink">UNREACHABLE</strong> — the studio was opened as a raw file, or embedded on a page outside the OGRP site — Finalize can't write same-origin. Download this tiny runner page once and upload it next to <span className="font-mono text-tech">index.html</span> in the same Site Assets library. It's served BY SharePoint, so it always has same-origin SSO: the studio opens it in a popup, hands it the payload, and it does the write on the studio's behalf.
            </p>
            <button type="button" onClick={downloadRunner}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold font-display bg-white hover:bg-mist text-ink border border-line transition active:scale-[0.98]">
              <Terminal className="w-3.5 h-3.5 text-warn" /> Download dispatch-runner.html
            </button>
          </div>

          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <Table className="w-4 h-4 text-tech" />
              <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">SharePoint schema · <span className="font-mono normal-case text-brand-deep">ITSM_Weekly_Updates</span></h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead><tr className="border-b border-line text-ink-soft font-mono text-[10px] uppercase tracking-wide">
                  <th className="py-2 px-2.5">Field</th><th className="py-2 px-2.5">Type</th><th className="py-2 px-2.5">Description</th>
                </tr></thead>
                <tbody className="divide-y divide-line/70">
                  {COLUMNS.map(col => (
                    <tr key={col.name} className="hover:bg-mist/60 transition">
                      <td className="py-2 px-2.5 font-mono text-tech font-semibold">{col.name}</td>
                      <td className="py-2 px-2.5 text-ink-soft font-mono text-[11px]">{col.type}</td>
                      <td className="py-2 px-2.5 text-ink text-[11px]">{col.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="terminal rounded-2xl overflow-hidden shadow-xl">
            <div className="terminal-titlebar px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-bright font-bold text-[11px] font-mono"><Terminal className="w-3.5 h-3.5" /> PnP PowerShell · one-click provisioning</div>
              <button onClick={handleCopyPnp} className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-md bg-navy-soft hover:bg-brand text-on-navy hover:text-white border border-navy-line transition active:scale-95 font-mono">
                {copiedPnp ? <Check className="w-3.5 h-3.5 mr-1 text-ok" /> : <Copy className="w-3.5 h-3.5 mr-1 text-brand-bright" />}{copiedPnp ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="p-5 text-[11px] text-[#bcd0f0] overflow-x-auto max-h-80 scrollbar-thin leading-relaxed font-mono">{SHAREPOINT_PNP_SCRIPT}</pre>
          </div>

          {/* No-PowerShell provisioning — creates the nine columns via the browser session */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-line flex-wrap">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-warn" />
                <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">No PowerShell? Provision from the browser</h3>
              </div>
              <span className="text-[10px] font-mono text-warn-deep bg-warn-soft border border-warn/40 rounded px-2 py-0.5">recommended for you right now</span>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed font-body">
              PnP isn't installed on your machine, so use this instead. On the <strong className="text-ink">Library Settings</strong> page you already have open (any page of the OGRP site works), press <kbd className="px-1 py-0.5 rounded bg-mist border border-line font-mono text-[10px]">F12</kbd> → <strong className="text-ink">Console</strong>, paste, Enter. It creates all nine columns through your logged-in session and prints a ✓ per column. Safe to re-run: existing columns are reported, not duplicated.
            </p>
            <div className="relative">
              <pre className="p-3 pr-14 rounded-lg bg-navy text-[10.5px] text-[#bcd0f0] overflow-x-auto scrollbar-thin leading-relaxed font-mono max-h-72">{PROVISION_SNIPPET}</pre>
              <button onClick={copyProv} className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold font-mono bg-navy-soft hover:bg-brand text-on-navy hover:text-white border border-navy-line transition active:scale-95">
                {copiedProv ? <><Check className="w-3 h-3 text-ok" /> Copied</> : <><Copy className="w-3 h-3 text-brand-bright" /> Copy</>}
              </button>
            </div>
            <p className="text-[10px] text-ink-soft font-body leading-relaxed border-t border-line pt-2">
              <strong className="text-ink">Pass:</strong> nine ✓ lines, then refresh this settings page — the nine names appear under Columns. <strong className="text-ink">Fail · HTTP 403:</strong> your account lacks “Manage Lists” on this library — tell me and we’ll add the nine through the <span className="font-mono">+ Add column</span> UI instead (exact names + types are in the schema table above). <strong className="text-ink">Fail · 400 “already exists”:</strong> that column is already there — fine, move on.
            </p>
          </div>

          {/* Verify the columns actually exist */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-line">
              <Check className="w-4 h-4 text-ok" />
              <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">Verify the columns landed</h3>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed font-body">
              Open any page of the OGRP site, press <kbd className="px-1 py-0.5 rounded bg-mist border border-line font-mono text-[10px]">F12</kbd> → <strong className="text-ink">Console</strong>, paste this and hit Enter. It reads the library straight from your logged-in session and prints every visible column with its internal name.
            </p>
            <div className="relative">
              <pre className="p-3 pr-14 rounded-lg bg-navy text-[10.5px] text-[#bcd0f0] overflow-x-auto scrollbar-thin leading-relaxed font-mono whitespace-pre-wrap break-all">{VERIFY_SNIPPET}</pre>
              <button onClick={copyVerify} className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold font-mono bg-navy-soft hover:bg-brand text-on-navy hover:text-white border border-navy-line transition active:scale-95">
                {copiedVerify ? <><Check className="w-3 h-3 text-ok" /> Copied</> : <><Copy className="w-3 h-3 text-brand-bright" /> Copy</>}
              </button>
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider mb-1.5">Expect these nine · Internal name is what the flow writes</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10.5px] font-mono">
                {EXPECTED_COLS.map(c => (
                  <div key={c} className="flex items-center gap-1.5 bg-paper border border-line rounded px-2 py-1 text-ink"><span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />{c}</div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-ink-soft font-body leading-relaxed border-t border-line pt-2">
              <strong className="text-ink">Pass:</strong> all nine print with exactly those internal names. <strong className="text-ink">Fail:</strong> rows are missing (the columns were never created) or names are mangled (e.g. <span className="font-mono">Items_x005f_JSON</span>) — send me the table and I’ll adjust the flow’s field mapping. If the headers don’t show in the library view, use <span className="font-mono">⋮ → Show or hide columns</span>; hidden-from-view ≠ missing.
            </p>
          </div>
        </div>

        {/* Right: digest */}
        <div className="lg:col-span-5">
          <div className="panel p-5 space-y-4 h-full">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-brand" /><h3 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">Outlook executive digest</h3></div>
              <span className="text-[10px] font-mono bg-brand-soft text-brand-deep px-2 py-0.5 rounded border border-brand/30">live preview</span>
            </div>

            <div className="bg-paper rounded-xl p-4 border border-line shadow-inner space-y-3 text-xs">
              <div className="border-b border-line pb-2 space-y-1 font-mono text-[11px]">
                <div className="text-ink-soft"><strong className="text-ink">From:</strong> flowbot@ingrammicro.com</div>
                <div className="text-ink-soft"><strong className="text-ink">To:</strong> {recipient}</div>
                <div className="font-display font-extrabold text-ink text-sm pt-0.5">📊 ITSM Weekly Status – {formData.reportWeek}</div>
              </div>

              <div className={`p-2.5 rounded-lg border font-mono font-bold text-[11px] flex justify-between items-center ${ragBanner}`}>
                <span>Overall status · auto</span><span>{overall.toUpperCase()}</span>
              </div>

              {formData.metricsAnalysis?.trim() && (
                <div className="space-y-1">
                  <strong className="text-ink text-[11px] block font-display">Remarks</strong>
                  <p className="text-[11px] italic text-ink-soft pl-2 leading-relaxed border-l-2 border-brand/40 line-clamp-3">{formData.metricsAnalysis}</p>
                </div>
              )}

              <div className="space-y-1">
                <strong className="text-ink text-[11px] block font-display">✅ Completed · {comp.length}</strong>
                {comp.length === 0 ? <p className="text-[11px] text-ink-soft italic pl-2">No closed items yet.</p> :
                  comp.slice(0, 2).map(it => (
                    <div key={it.id} className="flex items-start gap-1.5 pl-2 text-[11px] text-ink-soft border-l-2 border-ok/40">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ragDot(it.rag)}`} /><span className="line-clamp-2">{it.text}</span>
                    </div>
                  ))}
              </div>

              <div className="space-y-1 pt-1">
                <strong className="text-ink text-[11px] block font-display">📌 Priorities · {act.length}</strong>
                {act.slice(0, 3).map(it => (
                  <div key={it.id} className="flex items-start gap-1.5 pl-2 text-[11px] text-ink-soft border-l-2 border-brand/40">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ragDot(it.rag)}`} /><span className="line-clamp-2">{it.text}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-[10px] text-ink-soft border-t border-line flex justify-between font-mono">
                <span>Finalized at window close</span><span>Ingram Micro · Xvantage</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

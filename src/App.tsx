import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { TeamsFlowCardStudio } from './components/TeamsFlowCardStudio';
import { PowerAutomateFlowViewer } from './components/PowerAutomateFlowViewer';
import { ExecutiveReportView } from './components/ExecutiveReportView';
import { AdaptiveCardJsonViewer } from './components/AdaptiveCardJsonViewer';
import { M365ConnectionKit } from './components/M365ConnectionKit';
import { DeliverablesPreview } from './components/DeliverablesPreview';
import { BrandLockup } from './components/BrandLockup';
import { INITIAL_INGRAM_DATA, INITIAL_CAPGEMINI_DATA, INITIAL_FLOWCARD_DATA, METRICS_DATA } from './data/defaultReport';
import { FlowCardFormData, MergedItem, MetricRow, RagStatus, computeOverallRag, activeItems } from './types/itsm';
import { MergeStudio } from './components/MergeStudio';
import { TeamWeeklyDocReport } from './components/TeamWeeklyDocReport';
import { buildMergedItems, acceptedAsFlowItems } from './utils/mergeEngine';
import { recalcMetric } from './utils/rag-ui';
import { generatePowerAutomateFlowDefinitionJson } from './data/powerAutomateWorkflow';

type TabKey = 'flowcard-ingram' | 'flowcard-capgemini' | 'team-doc' | 'merge-studio' | 'flow-builder' | 'executive-report' | 'adaptive-json' | 'm365-connections' | 'deliverables';
interface LogEntry { timestamp: string; step: string; status: 'pending' | 'success' | 'running'; }
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const INITIAL_LOG: LogEntry[] = [
  { timestamp: '08:00:00', step: '1. Recurrence fired Mon 08:00 — window opened', status: 'success' },
  { timestamp: '08:00:01', step: '2. Adaptive Card posted · seeded from last week', status: 'success' },
  { timestamp: '08:00:02', step: '3. Awaiting edits · closes Mon 07:00…', status: 'running' },
];

const nextWeekLabel = (s: string) => {
  const m = s.match(/Week of (.+)/); if (!m) return s;
  const d = new Date(m[1]); if (isNaN(d.getTime())) return s;
  d.setDate(d.getDate() + 7);
  return `Week of ${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

// ── SharePoint-hosted deployment ────────────────────────────────────────────
// The studio is expected to run FROM inside the OGRP SharePoint site (via an
// Embed web part on a modern page, or as a hosted .aspx). That makes every
// REST call same-origin and every SSO cookie automatic, so the direct write
// to the dispatch queue works with no popup, no runner file, no console paste.
const OGRP_SITE = 'https://ingrammicro.sharepoint.com/sites/OGRP-TigerTeam-IOCPhilippines-InformationTechnology';
const QUEUE_LIST = 'ITSM_Dispatch_Queue';

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('flowcard-ingram');
  const [ingramData, setIngramData] = useState<FlowCardFormData>(INITIAL_INGRAM_DATA);
  const [capgeminiData, setCapgeminiData] = useState<FlowCardFormData>(INITIAL_CAPGEMINI_DATA);
  const [mergedItems, setMergedItems] = useState<MergedItem[]>(() => buildMergedItems(INITIAL_INGRAM_DATA.items, INITIAL_CAPGEMINI_DATA.items));

  // The "formData" used by the Report/Deliverables/JSON tabs is derived from the merge:
  // accepted items become the canonical item list for the final report.
  const formData = useMemo<FlowCardFormData>(() => {
    const items = acceptedAsFlowItems(mergedItems);
    return {
      ...ingramData,
      items,
      metricsAnalysis: ingramData.metricsAnalysis,
      metricsAnalysisByHuman: ingramData.metricsAnalysisByHuman,
    };
  }, [mergedItems, ingramData]);
  const setFormData = (fn: React.SetStateAction<FlowCardFormData>) => {
    // Updates from the Report tab (e.g. remarks) go to the Ingram form data
    setIngramData(fn);
  };
  const [rawMetrics, setRawMetrics] = useState<MetricRow[]>(METRICS_DATA);
  const [isSimulating, setIsSimulating] = useState(false);
  const [submissionLog, setSubmissionLog] = useState<LogEntry[]>(INITIAL_LOG);
  const [finalizedAt, setFinalizedAt] = useState<number | null>(null);

  // Queue status — 'ok' when the list is reachable from this browser session,
  // 'missing' when the list itself doesn't exist yet, 'checking' during the probe.
  // We no longer track a 'blocked' state because SharePoint-hosted deployment
  // removes the cross-origin failure mode entirely.
  const [queueStatus, setQueueStatus] = useState<'unknown' | 'checking' | 'ok' | 'missing'>('unknown');

  const verifyQueue = async () => {
    setQueueStatus('checking');
    try {
      const r = await fetch(`${OGRP_SITE}/_api/web/lists/getbytitle('${QUEUE_LIST}')/ListItemEntityTypeFullName`, {
        headers: { Accept: 'application/json;odata=verbose' }, credentials: 'include',
      });
      if (r.status === 404) { setQueueStatus('missing'); return; }
      setQueueStatus(r.ok ? 'ok' : 'missing');
    } catch { setQueueStatus('missing'); }
  };

  // Intended recipient for the digest — single mailbox while wiring, rotated to
  // the distribution only once the pipe is proven. Stored per-browser.
  const DEFAULT_RECIPIENT = 'patrickharvey.gaddi@ingrammicro.com';
  const [recipient, setRecipient] = useState<string>(() => {
    try { return localStorage.getItem('itsm_recipient') || DEFAULT_RECIPIENT; } catch { return DEFAULT_RECIPIENT; }
  });
  const persistRecipient = (v: string) => {
    setRecipient(v);
    try { localStorage.setItem('itsm_recipient', v); } catch { /* ignore */ }
  };

  const metrics = useMemo(() => rawMetrics.map(recalcMetric), [rawMetrics]);
  const onMetricChange = (id: string, field: 'target' | 'mtd' | 'lastWeek' | 'weekOfJul13', value: string) =>
    setRawMetrics(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)));
  const onAnalysisCommit = (text: string, byHuman: boolean) =>
    setFormData(s => ({ ...s, metricsAnalysis: text, metricsAnalysisByHuman: byHuman }));

  const overall = useMemo<RagStatus>(() => {
    const rags: RagStatus[] = [...activeItems(formData.items).map(i => i.rag), ...metrics.map(m => m.rag)];
    return computeOverallRag(rags);
  }, [formData.items, metrics]);

  const OPEN_MS = useMemo(() => new Date('2026-07-13T08:00:00').getTime(), []);
  const CLOSE_MS = useMemo(() => new Date('2026-07-20T07:00:00').getTime(), []);
  const [phase, setPhase] = useState<'open' | 'closed'>('open');
  const [nowMs, setNowMs] = useState(() => OPEN_MS + 1000 * 60 * 60 * 52 + 1000 * 60 * 17);
  useEffect(() => { const id = setInterval(() => setNowMs(n => n + 1000), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (phase === 'open' && nowMs >= CLOSE_MS) void finalize(); /* eslint-disable-next-line */ }, [nowMs, phase]);
  const locked = phase === 'closed';

  async function finalize() {
    if (isSimulating || locked) return;
    setIsSimulating(true);
    const now = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
    const a = activeItems(formData.items).length;
    const c = formData.items.filter(i => i.complete && !i.archived).length;

    setSubmissionLog(prev => [
      ...prev.filter(l => !l.step.startsWith('3. Awaiting')),
      { timestamp: now(), step: `3. Report finalized · ${a} active + ${c} completed`, status: 'success' },
    ]);

    // Build the payload
    const compItems = formData.items.filter(i => i.complete && !i.archived);
    const actItems = activeItems(formData.items);
    const snap = (arr: typeof formData.items) =>
      arr.map(i => `[${i.rag.toUpperCase()}] ${i.text}${i.eta ? ` (${i.eta})` : ''}`).join('\n');
    const num = (s: string) => { const n = parseFloat(String(s).replace('%', '').trim()); return isNaN(n) ? 0 : n; };
    const miWeek = metrics.find(m => m.id === 'mi_count')?.weekOfJul13 ?? '';
    const adWeek = metrics.find(m => m.id === 'mi_detection')?.weekOfJul13 ?? '';
    const payload = {
      reportWeek: formData.reportWeek,
      overallRag: overall,
      ragStatus: overall.charAt(0).toUpperCase() + overall.slice(1),
      metricsAnalysis: formData.metricsAnalysis,
      fileName: `ITSM-Weekly-${Date.now()}.json`,
      majorIncidents: num(miWeek),
      alertDetection: num(adWeek),
      completedCount: compItems.length,
      activeCount: actItems.length,
      completedSnapshot: snap(compItems),
      prioritiesSnapshot: snap(actItems),
      metrics: metrics.map(m => ({
        id: m.id, metric: m.metric, short: m.short, target: m.target, mtd: m.mtd,
        lastWeek: m.lastWeek, weekOfJul13: m.weekOfJul13, rag: m.rag, trend: m.trend
      })),
      itemsJson: JSON.stringify(formData.items.map(i => ({
        id: i.id, pillar: i.pillar, text: i.text, rag: i.rag, eta: i.eta,
        complete: i.complete, archived: i.archived
      }))),
      metricsJson: JSON.stringify(metrics.map(m => ({
        id: m.id, metric: m.metric, short: m.short, target: m.target, mtd: m.mtd,
        lastWeek: m.lastWeek, weekOfJul13: m.weekOfJul13, rag: m.rag, trend: m.trend
      }))),
      items: formData.items.map(i => ({
        id: i.id, pillar: i.pillar, text: i.text, rag: i.rag, eta: i.eta,
        complete: i.complete, archived: i.archived
      }))
    };

    // ── Direct same-origin write to the dispatch queue ─────────────────────
    // Works reliably because this studio is served from inside SharePoint
    // (Embed web part on the OGRP site). The visitor's SSO cookie travels with
    // the fetch, no popup, no runner file, no CORS. Flow B fires on the new
    // list item and does the rest (Word doc write + email).
    setSubmissionLog(prev => [
      ...prev,
      { timestamp: now(), step: '4. Writing dispatch ticket to SharePoint…', status: 'running' }
    ]);

    try {
      // Form digest
      const digRes = await fetch(`${OGRP_SITE}/_api/contextinfo`, {
        method: 'POST',
        headers: { Accept: 'application/json;odata=verbose' },
        credentials: 'include',
      });
      if (!digRes.ok) throw new Error(`Auth failed (HTTP ${digRes.status}). Reload the page and sign back in.`);
      const digest = (await digRes.json()).d.GetContextWebInformation.FormDigestValue;

      // List entity type
      const etRes = await fetch(`${OGRP_SITE}/_api/web/lists/getbytitle('${QUEUE_LIST}')/ListItemEntityTypeFullName`, {
        headers: { Accept: 'application/json;odata=verbose' }, credentials: 'include',
      });
      if (etRes.status === 404) {
        setQueueStatus('missing');
        throw new Error(`Queue list "${QUEUE_LIST}" not found — provision it on the M365 Connections tab first.`);
      }
      if (!etRes.ok) throw new Error(`Cannot read queue list (HTTP ${etRes.status}).`);
      const entityType = (await etRes.json()).d.ListItemEntityTypeFullName;

      // Write the item
      const res = await fetch(`${OGRP_SITE}/_api/web/lists/getbytitle('${QUEUE_LIST}')/items`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'X-RequestDigest': digest,
        },
        body: JSON.stringify({ __metadata: { type: entityType }, Title: payload.reportWeek, Payload: JSON.stringify(payload) }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const detail = errBody?.error?.message?.value ? ` — ${String(errBody.error.message.value).slice(0, 140)}` : '';
        throw new Error(`Queue write failed (HTTP ${res.status})${detail}`);
      }

      setSubmissionLog(prev => [
        ...prev.map(l => (l.step.includes('Writing dispatch ticket') ? { ...l, status: 'success' as const } : l)),
        { timestamp: now(), step: '5. ✅ Ticket queued · Flow B waking on the new item…', status: 'success' },
        { timestamp: now(), step: '6. File + Outlook digest land in ~20s · check your inbox', status: 'success' }
      ]);
      setQueueStatus('ok');
      setFinalizedAt(Date.now());
      setPhase('closed');
      setNowMs(CLOSE_MS + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmissionLog(prev => [
        ...prev.map(l => (l.step.includes('Writing dispatch ticket') ? { ...l, status: 'pending' as const } : l)),
        { timestamp: now(), step: `❌ ${msg}`, status: 'success' },
        { timestamp: now(), step: 'Make sure the studio is opened from inside SharePoint (Embed page), not the raw file link.', status: 'success' },
      ]);
    } finally {
      setIsSimulating(false);
    }
  }

  const onNewWeek = () => {
    setPhase('open');
    setNowMs(OPEN_MS + 1000 * 60 * 23);
    setFinalizedAt(null);
    setFormData(s => ({ ...s, reportWeek: nextWeekLabel(s.reportWeek) }));
    setSubmissionLog([
      { timestamp: '08:00:00', step: '1. New week · window reopened Mon 08:00', status: 'success' },
      { timestamp: '08:00:01', step: '2. Card seeded: carry-forward + closed wins', status: 'success' },
      { timestamp: '08:00:02', step: '3. Awaiting edits · closes Mon 07:00…', status: 'running' },
    ]);
  };

  const handleDownloadFlowJson = () => {
    const flowJson = generatePowerAutomateFlowDefinitionJson();
    const blob = new Blob([JSON.stringify(flowJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ITSM_Weekly_FlowCard_PowerAutomate_Flow.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const handleReset = () => {
    setFormData(INITIAL_FLOWCARD_DATA); setRawMetrics(METRICS_DATA);
    setPhase('open'); setNowMs(OPEN_MS + 1000 * 60 * 60 * 52); setFinalizedAt(null); setSubmissionLog(INITIAL_LOG);
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-body antialiased relative selection:bg-brand/30">
      <div className="app-backdrop" aria-hidden="true" />
      <div className="relative z-10">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} onDownloadFlowJson={handleDownloadFlowJson} onResetToReportData={handleReset} overallRag={overall} />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div key={activeTab} className="animate-fade-up">
          {activeTab === 'flowcard-ingram' && (
            <TeamsFlowCardStudio
              formData={ingramData} setFormData={setIngramData} overall={overall} metrics={metrics}
              phase={phase} locked={locked} nowMs={nowMs} openMs={OPEN_MS} closeMs={CLOSE_MS}
              onCloseWindow={finalize} onNewWeek={onNewWeek}
              onGotoReport={() => setActiveTab('merge-studio')}
            />
          )}
          {activeTab === 'flowcard-capgemini' && (
            <TeamsFlowCardStudio
              formData={capgeminiData} setFormData={setCapgeminiData} overall={overall} metrics={metrics}
              phase={phase} locked={locked} nowMs={nowMs} openMs={OPEN_MS} closeMs={CLOSE_MS}
              onCloseWindow={finalize} onNewWeek={onNewWeek}
              onGotoReport={() => setActiveTab('merge-studio')}
            />
          )}
          {activeTab === 'team-doc' && (
            <TeamWeeklyDocReport ingramData={ingramData} capgeminiData={capgeminiData} />
          )}
          {activeTab === 'merge-studio' && (
            <MergeStudio
              ingramData={ingramData} capgeminiData={capgeminiData}
              mergedItems={mergedItems} setMergedItems={setMergedItems}
              onGotoReport={() => setActiveTab('executive-report')}
            />
          )}
          {activeTab === 'flow-builder' && <PowerAutomateFlowViewer />}
          {activeTab === 'executive-report' && (
            <ExecutiveReportView
              formData={formData} overall={overall} metrics={metrics} onMetricChange={onMetricChange}
              metricsAnalysis={formData.metricsAnalysis} analysisByHuman={!!formData.metricsAnalysisByHuman}
              onAnalysisCommit={onAnalysisCommit} onGotoFlowcard={() => setActiveTab('merge-studio')}
              phase={phase} locked={locked} nowMs={nowMs} closeMs={CLOSE_MS}
              onSubmit={finalize} isSimulating={isSimulating} submissionLog={submissionLog}
              finalizedAt={finalizedAt} onNewWeek={onNewWeek}
              queueStatus={queueStatus} onVerifyQueue={verifyQueue} recipient={recipient}
            />
          )}
          {activeTab === 'adaptive-json' && <AdaptiveCardJsonViewer formData={formData} overall={overall} />}
          {activeTab === 'm365-connections' && (
            <M365ConnectionKit
              formData={formData} overall={overall}
              queueStatus={queueStatus} onVerifyQueue={verifyQueue}
              recipient={recipient} setRecipient={persistRecipient}
            />
          )}
          {activeTab === 'deliverables' && (
            <DeliverablesPreview formData={formData} overall={overall} metrics={metrics} recipient={recipient} />
          )}
        </div>
      </main>

      <footer className="border-t border-line bg-mist/80 backdrop-blur-sm py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLockup />
            <span className="hidden sm:block w-px h-5 bg-line" />
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-ink-soft">
              <span className="w-2 h-2 rounded-full bg-brand-bright dot-live" /> ITSM FlowCard Studio · SharePoint-hosted
            </span>
          </div>
          <div className="text-[11px] text-ink-soft font-mono">{formData.reportWeek} · auto RAG {overall.toUpperCase()} · {finalizedAt ? 'distributed' : locked ? 'closed' : 'open'}</div>
        </div>
      </footer>
    </div>
  );
}

export default App;

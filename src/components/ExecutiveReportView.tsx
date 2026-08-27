import React, { useMemo, useState } from 'react';
import {
  FlowCardFormData, PillarType, RagStatus, PILLARS,
  activeItems, completedItems, itemsByPillar,
} from '../types/itsm';
import { RecalcMetric, ragDot, ragChip } from '../utils/rag-ui';
import { etaKind, etaTone, etaLabel } from '../utils/eta';
import { autoConsolidatedAnalysis } from '../utils/metricAnalyst';
import { BrandLockup } from './BrandLockup';
import {
  Cpu, Clock, Users, Flame, TrendingDown, TrendingUp, Minus,
  Check, Mail, Send, Lock, CheckCircle2, Play, Sparkles,
  Calendar, CalendarRange, Flag, Tag, Rocket, Pencil, X, Quote, ChevronLeft,
} from 'lucide-react';

type MetricField = 'target' | 'mtd' | 'lastWeek' | 'weekOfJul13';

interface Props {
  formData: FlowCardFormData;
  overall: RagStatus;
  metrics: RecalcMetric[];
  onMetricChange: (id: string, field: MetricField, value: string) => void;
  metricsAnalysis: string;
  analysisByHuman: boolean;
  onAnalysisCommit: (text: string, byHuman: boolean) => void;
  onGotoFlowcard: () => void;
  phase: 'open' | 'closed';
  locked: boolean;
  nowMs: number; closeMs: number;
  onSubmit: () => void;
  isSimulating: boolean;
  submissionLog: { timestamp: string; step: string; status: 'pending' | 'success' | 'running' }[];
  finalizedAt: number | null;
  onNewWeek: () => void;
  queueStatus: 'unknown' | 'checking' | 'ok' | 'missing' | 'blocked';
  onVerifyQueue: () => void;
  recipient: string;
}

const PILLAR_META: Record<PillarType, { Icon: React.ElementType; icon: string }> = {
  People: { Icon: Users, icon: 'text-brand' },
  Process: { Icon: Clock, icon: 'text-xv-slate' },
  Technology: { Icon: Cpu, icon: 'text-tech' },
};
const SOFT: Record<RagStatus, string> = {
  green: 'bg-ok-soft text-ok-deep', yellow: 'bg-warn-soft text-warn-deep',
  red: 'bg-crit-soft text-crit-deep', na: 'bg-xv-soft text-xv-deep',
};

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtTime = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };
const fmtStamp = (ms: number) => { const d = new Date(ms); return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]} · ${fmtTime(ms)}`; };
const pad = (n: number) => String(n).padStart(2, '0');
const fmtCountdown = (ms: number) => {
  if (ms <= 0) return 'closed';
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 86400))}d ${pad(Math.floor((s % 86400) / 3600))}h ${pad(Math.floor((s % 3600) / 60))}m`;
};

const EtaInline: React.FC<{ eta: string }> = ({ eta }) => {
  const k = etaKind(eta);
  if (k === 'none') return <span className="text-[9px] text-ink-soft/60 font-mono">no ETA</span>;
  const t = etaTone(k);
  const G = k === 'date' ? Calendar : k === 'quarter' ? CalendarRange : k === 'tbd' ? Flag : Tag;
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-bold ${t.chip}`}><G className="w-2.5 h-2.5" />{etaLabel(eta)}</span>;
};
const RagDot: React.FC<{ rag: RagStatus }> = ({ rag }) => <span className={`w-2 h-2 rounded-full ${ragDot(rag)}`} title={rag} />;

export const ExecutiveReportView: React.FC<Props> = (p) => {
  const { formData, overall, metrics, onMetricChange, metricsAnalysis, analysisByHuman, onAnalysisCommit, onGotoFlowcard, locked, nowMs, closeMs, onSubmit, isSimulating, submissionLog, finalizedAt, onNewWeek, queueStatus, onVerifyQueue, recipient } = p;

  const live = queueStatus === 'ok';


  const act = useMemo(() => activeItems(formData.items), [formData.items]);
  const comp = useMemo(() => completedItems(formData.items), [formData.items]);
  const reds = useMemo(() => act.filter(i => i.rag === 'red').length + metrics.filter(m => m.rag === 'red').length, [act, metrics]);
  const remaining = closeMs - nowMs;

  // one consolidated read across every KPI
  const autoText = useMemo(
    () => autoConsolidatedAnalysis(metrics, { overall, activeCount: act.length, completedCount: comp.length }),
    [metrics, overall, act.length, comp.length]
  );
  const committed = (metricsAnalysis ?? '').trim();
  const words = committed ? committed.split(/\s+/).length : 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const openEditor = () => { setDraft(metricsAnalysis ?? ''); setSuggestion(null); setEditing(true); };
  const cancel = () => { setEditing(false); setSuggestion(null); };
  const done = () => { onAnalysisCommit(draft, true); setEditing(false); setSuggestion(null); };
  const regen = () => {
    const fresh = autoText;
    if (editing) {
      if (draft.trim() && draft.trim() !== fresh.trim()) setSuggestion(fresh);
      else { setDraft(fresh); setSuggestion(null); }
    } else if (!committed) {
      onAnalysisCommit(fresh, false);
    } else if (!analysisByHuman) {
      onAnalysisCommit(fresh, false);
    } else {
      setDraft(metricsAnalysis ?? ''); setSuggestion(fresh); setEditing(true);
    }
  };

  const cellCls = 'metric-cell w-full bg-paper border border-line rounded-md px-2 py-1 text-ink text-[11px] text-center focus:ring-2 focus:ring-brand focus:border-brand transition disabled:opacity-60 font-mono';

  const DigestGroup: React.FC<{ title: string; accent: string; Icon: React.ElementType; items: typeof act; empty: string }> = ({ title, accent, Icon, items, empty }) => (
    <div className="space-y-2">
      <div className={`flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider font-display ${accent}`}><Icon className="w-3.5 h-3.5" /> {title}</div>
      {PILLARS.map(pl => {
        const list = itemsByPillar(items, pl);
        if (list.length === 0) return null;
        const pm = PILLAR_META[pl];
        return (
          <div key={pl} className="space-y-1">
            <div className={`text-[10px] font-mono font-bold uppercase tracking-wide flex items-center gap-1 ${pm.icon}`}><pm.Icon className="w-3 h-3" /> {pl}</div>
            <ul className="space-y-1 pl-1">
              {list.map(it => (
                <li key={it.id} className="flex items-start gap-1.5 text-[11px] text-ink/90 leading-snug border-l-2 border-line/80 pl-2 py-0.5">
                  <span className="mt-1 shrink-0"><RagDot rag={it.rag} /></span>
                  <span className="flex-1 font-body">{it.text}</span>
                  <span className="shrink-0"><EtaInline eta={it.eta} /></span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {items.length === 0 && <p className="text-[11px] text-ink-soft italic pl-1 font-body">{empty}</p>}
    </div>
  );

  const step2Done = !!finalizedAt;

  return (
    <div className="space-y-6">
      {/* Wizard header — orientation + the way back to your updates */}
      <div className="flex items-center justify-between gap-3 flex-wrap reveal" style={{ ['--d' as string]: '0.02s' }}>
        <button
          type="button"
          onClick={onGotoFlowcard}
          aria-label="Go back to your FlowCard updates"
          className="group inline-flex items-center gap-1.5 pl-1 pr-3 py-1.5 rounded-lg text-[12px] font-bold font-display text-ink-soft hover:text-brand-deep hover:bg-brand-soft/60 border border-transparent hover:border-brand/30 transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand-deep"
        >
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-paper border border-line group-hover:bg-white group-hover:border-brand/40 transition">
            <ChevronLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          </span>
          Back to your updates
        </button>

        <nav aria-label="Weekly status steps" className="flex items-center gap-2 text-[11px] font-mono">
          {/* step 1 — visited / clickable back */}
          <button
            type="button"
            onClick={onGotoFlowcard}
            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-brand-soft/70 border-brand/30 text-brand-deep hover:bg-brand-soft hover:border-brand/50 transition"
          >
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand text-white">
              <Check className="w-2.5 h-2.5" />
            </span>
            <span className="font-bold tracking-wide">1 · YOUR UPDATES</span>
            <span className="text-brand-deep/60 group-hover:text-brand-deep transition">edit</span>
          </button>

          <span className="w-6 h-px bg-line" />

          {/* step 2 — here / done */}
          <span
            aria-current={step2Done ? undefined : 'step'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition ${
              step2Done
                ? 'bg-ok-soft border-ok/40 text-ok-deep'
                : 'bg-brand text-white border-brand-deep/40 shadow-sm shadow-brand/30'
            }`}
          >
            <span className={`relative inline-flex items-center justify-center w-4 h-4 rounded-full ${step2Done ? 'bg-ok text-white' : 'bg-white/20 text-white'}`}>
              {step2Done ? (
                <Check className="w-2.5 h-2.5" />
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span className="absolute inset-0 rounded-full bg-white/70 animate-ping" />
                </>
              )}
            </span>
            <span className="font-bold tracking-wide">2 · KPIs &amp; FINALIZE</span>
            {step2Done && <span className="text-ok-deep/70">sent</span>}
          </span>
        </nav>
      </div>

      {/* Hero — the press room */}
      <section className="stripes panel-soft rounded-2xl p-8 sm:p-10 relative overflow-hidden reveal">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand to-brand-deep" />
        <div className="relative z-10 flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line/70">
          <BrandLockup />
          <span className="text-[10px] font-mono text-ink-soft bg-white/70 border border-line rounded px-2 py-1">press room · {formData.reportWeek}</span>
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/80 border border-line text-[11px] font-bold font-mono text-brand-deep uppercase tracking-wider"><Rocket className="w-3.5 h-3.5 text-brand" /> Consolidate &amp; distribute</span>
              <span className={`text-xs font-mono flex items-center gap-1.5 ${finalizedAt ? 'text-ok-deep' : locked ? 'text-crit-deep' : 'text-ink-soft'}`}>
                <span className={`w-2 h-2 rounded-full ${finalizedAt ? 'bg-ok' : locked ? 'bg-crit' : 'bg-warn dot-live'}`} />
                {finalizedAt ? `Distributed ${fmtTime(finalizedAt)}` : locked ? 'Window closed' : 'Draft · window open'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight leading-tight">
              Enter the KPIs, shape your remarks, then fire it
            </h2>
            <p className="text-sm text-ink-soft/90 leading-relaxed font-body max-w-xl">
              The items are locked in from the FlowCard. Type the metric values — RAG and trend compute themselves — then shape the Remarks that span every KPI: they open pre-written by the analyst engine, you edit them, and they commit on <strong className="text-ink">Done</strong>. Review the report and send to the configured recipient and SharePoint in one click.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono text-ink-soft uppercase tracking-widest">Auto RAG</span>
            <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${overall === 'green' ? 'from-ok-soft to-ok/25 border-ok/60' : overall === 'yellow' ? 'from-warn-soft to-warn/25 border-warn/60' : 'from-crit-soft to-crit/25 border-crit/60'} border-4 flex items-center justify-center shadow-xl`}>
              <div className={`w-14 h-14 rounded-full shadow-lg ${overall === 'green' ? 'bg-ok' : overall === 'yellow' ? 'bg-warn' : 'bg-crit'}`} />
            </div>
            <span className={`text-base font-extrabold font-display tracking-wide ${overall === 'green' ? 'text-ok-deep' : overall === 'yellow' ? 'text-warn-deep' : 'text-crit-deep'}`}>{overall.toUpperCase()}</span>
            <span className="text-[10px] font-mono text-ink-soft lowercase">{reds} critical · {act.length} active · {comp.length} closed</span>
          </div>
        </div>
      </section>

      {/* KPI telemetry (numbers only — the read lives in the panel below) */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line flex-wrap gap-2">
          <div className="flex items-center gap-2"><Flame className="w-5 h-5 text-crit" /><h3 className="text-sm font-extrabold text-ink uppercase tracking-wider font-display">📊 KPI telemetry</h3></div>
          <span className="text-[11px] text-ink-soft font-mono bg-mist px-2 py-0.5 rounded border border-line flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-brand" /> RAG &amp; trend auto-compute · feed the Remarks below</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[880px]">
            <thead>
              <tr className="border-b border-line text-ink-soft font-mono text-[10px] uppercase tracking-wide">
                <th className="py-2.5 px-3">Metric</th>
                <th className="py-2.5 px-3 w-24">Target</th>
                <th className="py-2.5 px-3 w-24">MTD</th>
                <th className="py-2.5 px-3">RAG · auto</th>
                <th className="py-2.5 px-3 w-24">Last wk</th>
                <th className="py-2.5 px-3 w-24">This wk</th>
                <th className="py-2.5 px-3">Trend · auto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {metrics.map((row, idx) => (
                <tr key={row.id} className="hover:bg-mist/40 transition">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${SOFT[row.rag]}`}>{String(idx + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-ink font-display leading-tight">{row.metric}</div>
                        <div className="text-[10px] text-ink-soft font-mono">{row.lowerIsBetter ? '▼ lower is better' : '▲ higher is better'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3"><input disabled={locked} value={row.target} onChange={e => onMetricChange(row.id, 'target', e.target.value)} className={cellCls} /></td>
                  <td className="py-2.5 px-3"><input disabled={locked} value={row.mtd} onChange={e => onMetricChange(row.id, 'mtd', e.target.value)} className={cellCls} /></td>
                  <td className="py-2.5 px-3"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono border ${ragChip(row.rag)}`}><RagDot rag={row.rag} />{row.rag === 'na' ? 'N/A' : row.rag[0].toUpperCase() + row.rag.slice(1)}</span></td>
                  <td className="py-2.5 px-3"><input disabled={locked} value={row.lastWeek} onChange={e => onMetricChange(row.id, 'lastWeek', e.target.value)} className={cellCls} /></td>
                  <td className="py-2.5 px-3"><input disabled={locked} value={row.weekOfJul13} onChange={e => onMetricChange(row.id, 'weekOfJul13', e.target.value)} className={`${cellCls} font-extrabold text-brand-deep`} /></td>
                  <td className="py-2.5 px-3">
                    <span className="flex items-center gap-1.5">
                      {row.dir === 'improved' ? <TrendingDown className="w-4 h-4 text-ok shrink-0" /> : row.dir === 'degraded' ? <TrendingUp className="w-4 h-4 text-crit shrink-0" /> : <Minus className="w-4 h-4 text-ink-soft shrink-0" />}
                      <span className={`text-[11px] font-medium font-body ${row.dir === 'improved' ? 'text-ok-deep' : row.dir === 'degraded' ? 'text-crit-deep' : 'text-ink-soft'}`}>{row.trend}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── The one consolidated Remarks read ──────────────────────────── */}
      <div className={`panel relative overflow-hidden transition-all ${editing ? 'ring-2 ring-brand/30' : ''}`}>
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand to-brand-deep" />
        <div className="p-5 sm:p-6 pl-6 sm:pl-7 space-y-4">
          {/* header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand-deep flex items-center justify-center shrink-0 border border-brand/30 shadow-sm">
                <Quote className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-ink uppercase tracking-wider font-display flex items-center gap-2">
                  Remarks
                  <span className={`inline-flex items-center gap-1 rounded-full border font-mono font-bold px-2 py-0.5 text-[10px] normal-case tracking-normal ${analysisByHuman ? 'bg-brand-soft text-brand-deep border-brand/40' : 'bg-ok-soft text-ok-deep border-ok/40'}`}>
                    {analysisByHuman ? <Pencil className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                    {analysisByHuman ? 'Edited by you' : 'AI-assisted draft'}
                  </span>
                </h3>
                <p className="text-[12px] text-ink-soft font-body mt-0.5">
                  One read across every KPI above. It opens pre-written by the analyst engine — edit it to add the context only you know, then press <strong className="text-ink">Done</strong> to save it into the report.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {editing ? (
                <>
                  <span className="text-[10px] font-mono text-ink-soft tabular-nums">{draft.trim() ? draft.trim().split(/\s+/).length : 0} words</span>
                  <button onClick={regen} disabled={locked} title="Redraft from the current KPIs"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-warn-soft text-warn-deep border border-warn/40 hover:bg-warn hover:text-white transition disabled:opacity-40 active:scale-95">
                    <Sparkles className="w-3.5 h-3.5" /> Regenerate
                  </button>
                  <button onClick={cancel}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-paper border border-line text-ink hover:bg-mist transition active:scale-95">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={done} disabled={!draft.trim()}
                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-extrabold font-display bg-gradient-to-r from-brand to-brand-bright hover:from-brand-deep hover:to-brand text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition disabled:opacity-40 disabled:shadow-none active:scale-95">
                    <Check className="w-3.5 h-3.5" /> Done
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-mono text-ink-soft tabular-nums">{words} words</span>
                  <button onClick={regen} disabled={locked} title="Redraft from the current KPIs"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-paper border border-line text-ink-soft hover:text-brand-deep hover:border-brand/50 hover:bg-brand-soft/50 transition disabled:opacity-40 active:scale-95">
                    <Sparkles className="w-3.5 h-3.5" /> Regenerate
                  </button>
                  <button onClick={openEditor} disabled={locked}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold font-display bg-paper border border-brand/40 text-brand-deep hover:bg-brand-soft transition disabled:opacity-40 active:scale-95">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                </>
              )}
            </div>
          </div>

          {/* body */}
          {editing ? (
            <div className="space-y-3 animate-fade-up">
              {/* live KPI chips so the numbers stay in view while writing */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider mr-0.5">In view</span>
                {metrics.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 bg-mist/70 border border-line rounded-full px-2 py-0.5 text-[10px] font-mono">
                    <RagDot rag={m.rag} /><span className="font-bold text-ink font-display">{m.short}</span><span className="text-ink-soft">{m.weekOfJul13}</span>
                  </span>
                ))}
              </div>

              {suggestion != null && (
                <div className="bg-brand-soft/70 border border-brand/30 rounded-lg p-3 text-[12px] text-brand-deep flex items-start gap-2.5 animate-fade-up">
                  <Quote className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold flex items-center gap-1 font-display"><Sparkles className="w-3.5 h-3.5" /> AI redraft from the current KPIs</div>
                    <p className="mt-1 leading-relaxed font-body">{suggestion}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => { setDraft(suggestion); setSuggestion(null); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-brand text-white hover:bg-brand-deep transition active:scale-95"><Check className="w-3 h-3" /> Use it</button>
                    <button onClick={() => setSuggestion(null)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-white border border-brand/40 text-brand-deep hover:bg-mist transition active:scale-95"><X className="w-3 h-3" /> Keep mine</button>
                  </div>
                </div>
              )}

              <textarea
                rows={6}
                disabled={locked}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Write the executive read — what moved, why it matters, what the team is doing about it. Or press Regenerate for a data-driven draft."
                style={{ backgroundImage: 'linear-gradient(90deg, transparent 33px, rgba(61,109,181,0.35) 33px, rgba(61,109,181,0.35) 34px, transparent 34px)' }}
                className="w-full bg-paper border border-line rounded-xl py-3 pr-4 pl-11 text-[13.5px] text-ink leading-[1.7] font-body focus:ring-2 focus:ring-brand focus:border-brand transition disabled:opacity-60 resize-y"
              />
              <p className="text-[11px] text-ink-soft font-body flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-ink-soft/70" /> Nothing is written to the digest or SharePoint until you press <strong className="text-ink">Done</strong>. Cancel discards your edits.
              </p>
            </div>
          ) : committed ? (
            <div className="relative pl-7 sm:pl-9 animate-fade-up">
              <Quote className="absolute left-0 top-0 w-7 h-7 text-brand/20" />
              <p className="text-[14px] sm:text-[15px] text-ink/90 leading-[1.75] font-body">{committed}</p>
            </div>
          ) : (
            <div className="border border-dashed border-line rounded-xl bg-mist/30 p-5 text-center space-y-2 animate-fade-up">
              <p className="text-[13px] text-ink-soft font-body">No remarks yet. Generate a data-driven draft, or open the editor and write your own.</p>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => onAnalysisCommit(autoText, false)} disabled={locked}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-extrabold font-display bg-gradient-to-r from-brand to-brand-bright hover:from-brand-deep hover:to-brand text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition disabled:opacity-40 active:scale-95">
                  <Sparkles className="w-4 h-4" /> Generate draft
                </button>
                <button onClick={openEditor} disabled={locked}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-bold font-display bg-paper border border-line text-ink hover:bg-mist transition disabled:opacity-40 active:scale-95">
                  <Pencil className="w-4 h-4 text-brand" /> Write from scratch
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Press area: digest + fire panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 relative">
          {finalizedAt && (
            <div className="absolute -top-3 left-6 z-20 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ok text-white text-[11px] font-bold font-mono shadow-lg shadow-ok/30 animate-fade-up">
              <CheckCircle2 className="w-3.5 h-3.5" /> DISPATCHED {fmtTime(finalizedAt)}
            </div>
          )}
          <div className={`panel p-5 space-y-4 ${finalizedAt ? 'ring-2 ring-ok/40' : ''}`}>
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-brand" /><h3 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">Consolidated digest · Outlook-ready</h3></div>
              <span className="text-[10px] font-mono text-ink-soft bg-mist px-2 py-0.5 rounded border border-line">{finalizedAt ? 'sent' : 'live preview'}</span>
            </div>

            <div className="bg-paper rounded-xl border border-line shadow-inner overflow-hidden">
              <div className="px-4 py-2.5 border-b border-line space-y-0.5 font-mono text-[11px] bg-mist/50">
                <div className="text-ink-soft"><strong className="text-ink">From:</strong> flowbot@ingrammicro.com</div>
                <div className="text-ink-soft"><strong className="text-ink">To:</strong> {recipient}</div>
                <div className="font-display font-medium text-ink-soft text-[13px] pt-1 flex items-center gap-1.5 flex-wrap"><span>📊 ITSM Weekly Status – {formData.reportWeek}</span><span className="text-line">|</span><span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide">RAG <span role="img" aria-label={overall} className="text-[13px] leading-none drop-shadow-sm">{overall === 'green' ? '🟢' : overall === 'yellow' ? '🟡' : overall === 'red' ? '🔴' : '⚪'}</span></span></div>
              </div>
              <div className="p-4 space-y-4">
                {/* lead with the work: what closed + what's still open */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DigestGroup title="✅ Completed" accent="text-ok-deep" Icon={CheckCircle2} items={comp} empty="No closed items this cycle." />
                  <DigestGroup title="📌 Priorities" accent="text-brand-deep" Icon={Cpu} items={act} empty="No active priorities." />
                </div>

                {/* KPI snapshot — the evidence, under the work */}
                <div className="border-t border-line pt-3">
                  <div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider mb-1">KPI snapshot</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {metrics.map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-2 bg-mist/60 border border-line rounded px-2 py-1.5">
                        <span className="text-[10px] font-bold text-ink font-display truncate">{m.short}</span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono font-bold text-ink">{m.weekOfJul13}</span>
                          <RagDot rag={m.rag} />
                          {m.dir === 'improved' ? <TrendingDown className="w-3 h-3 text-ok" /> : m.dir === 'degraded' ? <TrendingUp className="w-3 h-3 text-crit" /> : <Minus className="w-3 h-3 text-ink-soft" />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remarks — the closing read */}
                {committed && (
                  <div className="border-t border-line pt-3">
                    <div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider mb-1.5">Remarks</div>
                    <p className="text-[12px] italic text-ink/85 leading-relaxed font-body bg-mist/40 border-l-2 border-brand/40 rounded-r-md pl-3 pr-2 py-2">{committed}</p>
                  </div>
                )}

                <div className="pt-2 text-[10px] text-ink-soft border-t border-line flex justify-between font-mono">
                  <span>{finalizedAt ? `Finalized ${fmtStamp(finalizedAt)}` : 'Preview · finalizes on distribute'}</span>
                  <span>Ingram Micro · Xvantage</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fire panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`panel p-4 space-y-2 ${locked ? 'ring-2 ring-crit/40' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider">Submission window</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${locked ? 'bg-crit-soft text-crit-deep border-crit/40' : 'bg-ok-soft text-ok-deep border-ok/40'}`}>{locked ? 'CLOSED' : 'OPEN'}</span>
            </div>
            <div className="text-[11px] font-mono text-ink-soft">closes {fmtStamp(closeMs)}</div>
            {locked
              ? <div className="bg-crit-soft border border-crit/40 rounded-lg py-2 px-3 text-crit-deep font-display font-extrabold text-sm flex items-center justify-center gap-1.5"><Lock className="w-4 h-4" /> Closed for submission</div>
              : <div className="text-center"><div className="text-[10px] font-mono text-ink-soft uppercase tracking-widest">closes in</div><div className="font-mono text-xl font-extrabold text-ink tabular-nums tracking-tight caret">{fmtCountdown(remaining)}</div></div>}
          </div>

          {/* operational mode — DLP-safe queue dispatch */}
          <div className="panel p-4 bg-paper/50 border border-line space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider">Operational Mode</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                live ? 'bg-brand-soft text-brand-deep border-brand/40'
                : queueStatus === 'missing' ? 'bg-crit-soft text-crit-deep border-crit/40'
                : queueStatus === 'blocked' ? 'bg-warn-soft text-warn-deep border-warn/40'
                : 'bg-xv-soft text-xv-deep border-xv/40'
              }`}>
                {live ? 'LIVE · SharePoint queue' : queueStatus === 'checking' ? 'CHECKING…' : queueStatus === 'missing' ? 'QUEUE MISSING' : queueStatus === 'blocked' ? 'UNREACHABLE' : 'SANDBOX SIMULATION'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed font-body">
              {live
                ? <span className="text-brand-deep">Finalize writes a dispatch ticket to <span className="font-mono">ITSM_Dispatch_Queue</span>; Flow B fires on it. No HTTP trigger, no DLP conflict.</span>
                : queueStatus === 'missing'
                ? <span className="text-crit-deep">The queue list wasn’t found. Run the “create the dispatch queue” snippet on the M365 tab, then re-verify.</span>
                : queueStatus === 'blocked'
                ? <span className="text-warn-deep">Couldn’t reach SharePoint from this browser (cross-origin) — the studio isn’t being served from the OGRP site. Open it from the embedded SharePoint page, or Finalize will automatically try the dispatch runner popup fallback (set it up once on the M365 Connections tab).</span>
                : <span className="text-ink-soft">Sandbox mode. Verify the dispatch queue to enable live dispatches.</span>}
            </p>
            <button type="button" onClick={onVerifyQueue} disabled={queueStatus === 'checking' || locked}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-paper border border-line text-ink hover:bg-mist hover:border-brand/40 transition active:scale-[0.98] disabled:opacity-50">
              {queueStatus === 'checking' ? 'Checking…' : live ? 'Re-verify queue' : 'Verify dispatch queue'}
            </button>
          </div>

          <div className="panel p-5 space-y-3">
            {!finalizedAt ? (
              <>
                <button type="button" onClick={onSubmit} disabled={locked || isSimulating}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-extrabold font-display transition active:scale-[0.99] shadow-lg ${
                    locked ? 'bg-xv text-white cursor-not-allowed shadow-none'
                    : isSimulating ? 'bg-brand/70 text-white cursor-wait shadow-none'
                    : 'bg-gradient-to-r from-brand to-brand-bright hover:from-brand-deep hover:to-brand text-white shadow-brand/40 border border-brand-deep/40'}`}>
                  {locked ? <><Lock className="w-4 h-4" /> Window closed</>
                    : isSimulating ? <><Play className="w-4 h-4 animate-spin" /> Finalizing…</>
                    : live ? <><Send className="w-4 h-4" /> Finalize &amp; distribute LIVE</> : <><Send className="w-4 h-4" /> Finalize &amp; simulate</>}
                </button>
                <p className="text-[11px] text-ink-soft font-body leading-relaxed">
                  {live
                    ? 'Writes the dispatch ticket to SharePoint from your session · Flow B fires and does the file + email.'
                    : 'Simulates the weekly write-to-SharePoint, emails the mock digest to the configured recipient, and locks the Teams card.'}
                </p>
                {/* Console-command fallback removed — SharePoint-hosted deployment writes directly from Finalize. */}
              </>
            ) : (
              <div className="bg-ok-soft border border-ok/40 rounded-xl p-4 space-y-2 animate-fade-up">
                <div className="flex items-center gap-2 text-ok-deep font-display font-extrabold text-sm"><CheckCircle2 className="w-5 h-5" /> Distributed {fmtTime(finalizedAt)}</div>
                <ul className="text-[11px] text-ok-deep/90 font-body space-y-1 list-disc list-inside">
                  <li>SharePoint row written (items + KPIs + Remarks + auto RAG)</li>
                  <li>Outlook digest dispatched to the configured recipient</li>
                  <li>Teams card flipped to read-only “closed” state</li>
                </ul>
                <button type="button" onClick={onNewWeek}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 mt-1 text-xs font-bold rounded-lg bg-white hover:bg-mist text-ink border border-line transition active:scale-[0.98] font-mono">
                  ↺ Open a fresh week (Mon 08:00)
                </button>
              </div>
            )}
          </div>

          <div className="terminal rounded-2xl overflow-hidden shadow-xl">
            <div className="terminal-titlebar px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-bright font-bold text-[11px] font-mono uppercase tracking-wider"><Sparkles className="w-3.5 h-3.5" /> Distribution bus</div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono flex items-center gap-1 ${isSimulating ? 'bg-warn/20 text-warn border border-warn/40 animate-pulse' : 'bg-ok/20 text-ok border border-ok/40'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-warn' : 'bg-ok'}`} /> {isSimulating ? 'Running' : 'Ready'}
              </span>
            </div>
            <div className="p-5 space-y-2">
              {submissionLog.map((log, i) => (
                <div key={i} className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2.5 transition-all ${
                  log.status === 'success' ? 'bg-navy-deep/80 border-ok/40 text-on-navy'
                  : log.status === 'running' ? 'bg-warn/10 border-warn/50 text-warn animate-pulse'
                  : 'bg-navy-deep/60 border-navy-line text-on-navy-soft'}`}>
                  {log.status === 'success' ? <Check className="w-3.5 h-3.5 text-ok shrink-0 mt-0.5" />
                    : log.status === 'running' ? <Play className="w-3.5 h-3.5 text-warn shrink-0 animate-spin mt-0.5" />
                    : <div className="w-3.5 h-3.5 rounded-full border border-navy-line shrink-0 mt-0.5" />}
                  <span className="font-semibold truncate flex-1 font-body">{log.step}</span>
                  <span className="text-[10px] text-on-navy-soft font-mono shrink-0">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

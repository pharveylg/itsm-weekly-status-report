import React, { useMemo, useState } from 'react';
import { FlowCardFormData, RagStatus, activeItems, completedItems } from '../types/itsm';
import { RecalcMetric, ragDot } from '../utils/rag-ui';
import { etaKind, etaTone, etaLabel } from '../utils/eta';
import {
  Mail, Reply, ReplyAll, Forward, Trash2, Archive as ArchiveIcon, MoreHorizontal,
  Pencil, SlidersHorizontal, History, Zap, Puzzle, ChevronRight, ChevronDown,
  Copy, Check, Bot, Table2, Eye, Calendar, CalendarRange, Flag, Tag,
} from 'lucide-react';

interface Props { formData: FlowCardFormData; overall: RagStatus; metrics: RecalcMetric[]; recipient: string; }

const RagDot: React.FC<{ rag: RagStatus }> = ({ rag }) => <span className={`inline-block w-2 h-2 rounded-full ${ragDot(rag)}`} title={rag} />;

const EtaInline: React.FC<{ eta: string }> = ({ eta }) => {
  const k = etaKind(eta);
  if (k === 'none') return <span className="text-[9px] text-ink-soft/55 font-mono">—</span>;
  const t = etaTone(k);
  const G = k === 'date' ? Calendar : k === 'quarter' ? CalendarRange : k === 'tbd' ? Flag : Tag;
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-bold ${t.chip}`}><G className="w-2.5 h-2.5" />{etaLabel(eta)}</span>;
};

const GhostBtn: React.FC<{ Icon: React.ElementType; label?: string; onClick?: () => void; title?: string }> = ({ Icon, label, onClick, title }) => (
  <button type="button" onClick={onClick} title={title}
    className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold text-ink-soft hover:bg-mist hover:text-ink transition active:scale-95">
    <Icon className="w-3.5 h-3.5" />{label && <span className="hidden sm:inline">{label}</span>}
  </button>
);

export const DeliverablesPreview: React.FC<Props> = ({ formData, overall, metrics, recipient }) => {
  const act = activeItems(formData.items);
  const comp = completedItems(formData.items);
  const committed = (formData.metricsAnalysis ?? '').trim();
  const reds = act.filter(i => i.rag === 'red').length + metrics.filter(m => m.rag === 'red').length;

  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({ items: true, remarks: true, metrics: false });
  const [copied, setCopied] = useState<string | null>(null);
  const [ribbonNote, setRibbonNote] = useState(false);

  // Round-trippable payloads — exactly what the flow writes / the studio POSTs.
  const itemsJson = useMemo(() => JSON.stringify(
    formData.items.map(i => ({ id: i.id, pillar: i.pillar, text: i.text, rag: i.rag, eta: i.eta, complete: i.complete, archived: i.archived })), null, 2), [formData.items]);
  const metricsJson = useMemo(() => JSON.stringify(
    metrics.map(m => ({ id: m.id, metric: m.metric, short: m.short, target: m.target, mtd: m.mtd, lastWeek: m.lastWeek, weekOfJul13: m.weekOfJul13, rag: m.rag, trend: m.dir })), null, 2), [metrics]);

  const copy = (key: string, text: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };
  const pingRibbon = () => { setRibbonNote(true); setTimeout(() => setRibbonNote(false), 2200); };

  const subjectIcon = overall === 'green' ? '🟢' : overall === 'yellow' ? '🟡' : overall === 'red' ? '🔴' : '⚪';
  const SENT = 'Mon 20 Jul 2026 · 07:01';

  const digestText = useMemo(() => {
    const line = (it: typeof act[number]) => `  • [${it.rag.toUpperCase()}] ${it.text}${it.eta ? `  (${etaLabel(it.eta)})` : ''}`;
    const byP = (arr: typeof act, p: string) => arr.filter(i => i.pillar === p);
    const block = (title: string, arr: typeof act) =>
      `${title}\n${(['People', 'Process', 'Technology'] as const).map(p => { const l = byP(arr, p); return l.length ? `  ${p}\n${l.map(line).join('\n')}` : ''; }).filter(Boolean).join('\n')}`;
    return [
      `ITSM Weekly Status – ${formData.reportWeek}  |  RAG ${overall.toUpperCase()}`,
      `From: Power Automate <flowbot@ingrammicro.com>`,
      `To:   ${recipient}`,
      ``,
      block('COMPLETED', comp), ``, block('PRIORITIES', act), ``,
      `KPI SNAPSHOT`,
      ...metrics.map(m => `  • ${m.short.padEnd(9)} ${m.weekOfJul13}  (target ${m.target})  ${m.rag.toUpperCase()}  ${m.dir === 'improved' ? '▲' : m.dir === 'degraded' ? '▼' : '·'} ${m.trend}`),
      ``, committed ? `REMARKS\n${committed}` : '', ``,
      `— Ingram Micro · Xvantage`,
    ].filter(s => s !== undefined).join('\n');
  }, [formData.reportWeek, overall, comp, act, metrics, committed]);

  // one section of the email (Completed / Priorities) — deduped so the row markup,
  // including its ETA chip, lives in exactly one place.
  const EmailSection: React.FC<{ icon: string; label: string; n: number; accent: string; arr: typeof act }> = ({ icon, label, n, accent, arr }) => (
    <div>
      <div className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 ${accent}`}>{icon} {label} · {n}</div>
      {(['People', 'Process', 'Technology'] as const).map(p => { const l = arr.filter(i => i.pillar === p); if (!l.length) return null; return (
        <div key={p} className="mb-2"><div className="text-[10px] font-mono font-bold text-ink-soft">{p}</div>
          <ul className="space-y-1">{l.map(i => (
            <li key={i.id} className="flex items-start gap-1.5"><RagDot rag={i.rag} /><span className="flex-1">{i.text}</span><span className="shrink-0 mt-0.5"><EtaInline eta={i.eta} /></span></li>))}</ul></div>); })}
    </div>
  );

  // ── the email body, rendered inside the white message card ──────────────
  const EmailBody = () => (
    <div className="text-[13px] text-ink/90 leading-relaxed font-body space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <EmailSection icon="✅" label="Completed" n={comp.length} accent="text-ok-deep" arr={comp} />
        <EmailSection icon="📌" label="Priorities" n={act.length} accent="text-brand-deep" arr={act} />
      </div>

      <div className="border-t border-line pt-4">
        <div className="text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-2">KPI snapshot</div>
        <table className="w-full text-[11px] border-collapse">
          <thead><tr className="text-ink-soft font-mono text-[10px] uppercase tracking-wide border-b border-line">
            <th className="text-left py-1 pr-2">Metric</th><th className="text-right py-1 px-2">This wk</th><th className="text-right py-1 px-2">Target</th><th className="text-center py-1 px-2">RAG</th><th className="text-left py-1 pl-2">Move</th>
          </tr></thead>
          <tbody>{metrics.map(m => (
            <tr key={m.id} className="border-b border-line/60">
              <td className="py-1.5 pr-2 font-semibold text-ink">{m.short}</td>
              <td className="py-1.5 px-2 text-right font-mono font-bold text-ink">{m.weekOfJul13}</td>
              <td className="py-1.5 px-2 text-right font-mono text-ink-soft">{m.target}</td>
              <td className="py-1.5 px-2 text-center"><RagDot rag={m.rag} /></td>
              <td className="py-1.5 pl-2 text-ink-soft">{m.dir === 'improved' ? 'improving' : m.dir === 'degraded' ? 'drifting' : 'flat'}</td>
            </tr>))}</tbody>
        </table>
      </div>

      {committed && (
        <div className="border-t border-line pt-4">
          <div className="text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1.5">Remarks</div>
          <blockquote className="border-l-2 border-brand/50 pl-3 italic text-ink/80">{committed}</blockquote>
        </div>
      )}

      <div className="pt-2 text-[10px] text-ink-soft border-t border-line flex justify-between font-mono">
        <span>Auto-RAG {overall.toUpperCase()} · {reds} critical · {act.length} active · {comp.length} closed</span>
        <span>Ingram Micro · Xvantage</span>
      </div>
    </div>
  );

  // ── collapsible raw-field panel for the SharePoint form ─────────────────
  const CodePanel: React.FC<{ id: string; title: string; body: string; prose?: boolean }> = ({ id, title, body, prose }) => {
    const open = !!openPanels[id];
    return (
      <div className="border border-line rounded-lg overflow-hidden bg-paper">
        <div className="flex items-center justify-between px-3 py-2 bg-mist/60 border-b border-line">
          <button type="button" onClick={() => setOpenPanels(s => ({ ...s, [id]: !s[id] }))}
            className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-ink-soft hover:text-ink transition">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />{title}
            <span className="text-ink-soft/60 font-normal">{body.length.toLocaleString()} chars</span>
          </button>
          <button type="button" onClick={() => copy(id, body)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold font-mono text-ink-soft hover:bg-white hover:text-brand-deep border border-transparent hover:border-line transition active:scale-95">
            {copied === id ? <><Check className="w-3 h-3 text-ok" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
        </div>
        <div className={`transition-all duration-300 ${open ? 'max-h-72 overflow-auto scrollbar-thin' : 'max-h-0'}`}>
          {prose
            ? <p className="p-3 text-[12px] italic text-ink/85 leading-relaxed font-body">{body}</p>
            : <pre className="p-3 text-[11px] text-ink/85 font-mono leading-relaxed whitespace-pre">{body}</pre>}
        </div>
      </div>
    );
  };

  const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="space-y-0.5"><div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider">{label}</div><div className="text-[13px] text-ink font-body">{children}</div></div>
  );

  return (
    <div className="space-y-10">
      {/* ── DELIVERABLE 01 · THE EMAIL ─────────────────────────────────── */}
      <section className="space-y-3 reveal" style={{ ['--d' as string]: '0.02s' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[11px] font-mono font-bold text-brand-deep tracking-[0.2em] uppercase">Deliverable 01</span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink font-display tracking-tight">The email that gets sent</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-ok-deep bg-ok-soft border border-ok/40 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-ok dot-live" /> reflects your current edits
            </span>
            <button type="button" onClick={() => copy('digest', digestText)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-paper border border-line text-ink hover:bg-mist hover:border-brand/40 transition active:scale-95">
              {copied === 'digest' ? <><Check className="w-3.5 h-3.5 text-ok" /> Copied text</> : <><Copy className="w-3.5 h-3.5 text-brand" /> Copy digest (text)</>}
            </button>
          </div>
        </div>

        {/* Outlook window */}
        <div className="rounded-2xl overflow-hidden border border-line shadow-[0_30px_70px_-40px_rgba(16,42,82,0.55)] hover:-translate-y-0.5 transition-transform duration-300 bg-white">
          {/* title bar */}
          <div className="bg-navy px-4 py-2.5 flex items-center justify-between text-on-navy">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-brand flex items-center justify-center shadow"><Mail className="w-3.5 h-3.5 text-white" /></span>
              <span className="text-[12px] font-bold font-display">Inbox</span>
              <span className="text-[11px] text-on-navy-soft font-mono">— {recipient}</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
              <span className="w-3 h-px bg-on-navy-soft" /><span className="w-3 h-3 border border-on-navy-soft" /><span className="text-[13px] leading-none">×</span>
            </div>
          </div>
          {/* ribbon */}
          <div className="bg-paper border-b border-line px-2 py-1 flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-0.5">
              <GhostBtn Icon={Reply} label="Reply" onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={ReplyAll} label="Reply all" onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={Forward} label="Forward" onClick={pingRibbon} title="Preview only" />
              <span className="w-px h-5 bg-line mx-1" />
              <GhostBtn Icon={Trash2} onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={ArchiveIcon} onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={MoreHorizontal} onClick={pingRibbon} title="Preview only" />
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-brand-deep bg-brand-soft border border-brand/30 rounded-full px-2 py-0.5"><Eye className="w-3 h-3" /> live preview</span>
          </div>
          {ribbonNote && <div className="bg-warn-soft border-b border-warn/30 px-4 py-1.5 text-[11px] text-warn-deep font-body animate-fade-up">Preview only — in the real client these open the composer. The sent message itself is below.</div>}

          {/* reading pane */}
          <div className="bg-[#eef0f3] p-4 sm:p-6">
            <div className="max-w-[700px] mx-auto bg-white rounded-lg border border-line shadow-sm overflow-hidden">
              {/* message header */}
              <div className="px-5 sm:px-7 pt-5 pb-4 border-b border-line space-y-3">
                <div className="font-display font-medium text-ink-soft text-[15px] sm:text-[17px] flex items-center gap-2 flex-wrap">
                  <span>📊 ITSM Weekly Status – {formData.reportWeek}</span>
                  <span className="text-line">|</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[12px] tracking-wide">RAG <span role="img" aria-label={overall} className="text-[15px] leading-none drop-shadow-sm">{subjectIcon}</span></span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-soft text-brand-deep flex items-center justify-center shrink-0 border border-brand/30"><Bot className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-ink"><span className="font-bold">Power Automate</span> <span className="text-ink-soft">&lt;flowbot@ingrammicro.com&gt;</span></div>
                    <div className="text-[11.5px] text-ink-soft flex items-center gap-1">to <span className="text-ink font-medium">{recipient}</span> <ChevronDown className="w-3 h-3 opacity-60" /></div>
                  </div>
                  <div className="text-[11px] text-ink-soft font-mono shrink-0 pt-0.5">{SENT}</div>
                </div>
              </div>
              {/* message body */}
              <div className="px-5 sm:px-7 py-6"><EmailBody /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DELIVERABLE 02 · THE SHAREPOINT ROW ────────────────────────── */}
      <section className="space-y-3 reveal" style={{ ['--d' as string]: '0.12s' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[11px] font-mono font-bold text-tech tracking-[0.2em] uppercase">Deliverable 02</span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink font-display tracking-tight">The row SharePoint stores</h2>
          </div>
          <span className="text-[10px] font-mono text-ink-soft">next Monday's seed is read back from Items_JSON</span>
        </div>

        {/* SharePoint item form */}
        <div className="rounded-2xl overflow-hidden border border-line shadow-[0_30px_70px_-40px_rgba(16,42,82,0.55)] hover:-translate-y-0.5 transition-transform duration-300 bg-white">
          {/* title bar */}
          <div className="bg-navy px-4 py-2.5 flex items-center justify-between text-on-navy flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-tech flex items-center justify-center shadow"><Table2 className="w-3.5 h-3.5 text-white" /></span>
              <span className="text-[12px] font-bold font-display">ITSM_Weekly_Updates</span>
              <span className="text-[11px] text-on-navy-soft font-mono">· Item 1</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono text-on-navy-soft">
              <span>Sites</span><ChevronRight className="w-3 h-3" /><span>ITSM-Operations</span><ChevronRight className="w-3 h-3" /><span>Lists</span><ChevronRight className="w-3 h-3" /><span className="text-on-navy">ITSM_Weekly_Updates</span>
            </div>
          </div>
          {/* command bar */}
          <div className="bg-paper border-b border-line px-2 py-1 flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-0.5">
              <GhostBtn Icon={Pencil} label="Edit" onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={SlidersHorizontal} label="Manage" onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={History} label="Version history" onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={Zap} label="Automate" onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={Puzzle} label="Integrate" onClick={pingRibbon} title="Preview only" />
              <GhostBtn Icon={MoreHorizontal} onClick={pingRibbon} title="Preview only" />
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-tech bg-tech-soft border border-tech/30 rounded-full px-2 py-0.5"><Eye className="w-3 h-3" /> item view</span>
          </div>

          {/* display form */}
          <div className="p-5 sm:p-7 space-y-6 bg-paper">
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider">Title (row in the list)</div>
              <div className="text-lg font-extrabold text-ink font-display">{formData.reportWeek}</div>
              <p className="text-[11px] text-ink-soft font-body">Flow B writes one row per finalize here, plus the generated report as <span className="font-mono text-tech">ITSM-Weekly-{formData.reportWeek}.docx</span> in <span className="font-mono text-tech">ITSM Service Delivery</span> — linked back via Report_Doc_Url below.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="RAG_Status">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono border ${overall === 'green' ? 'bg-ok-soft text-ok-deep border-ok/40' : overall === 'yellow' ? 'bg-warn-soft text-warn-deep border-warn/40' : 'bg-crit-soft text-crit-deep border-crit/40'}`}>
                  <RagDot rag={overall} />{overall.toUpperCase()} <span className="opacity-60 font-normal">· auto</span>
                </span>
              </Field>
              <Field label="Major_Incidents"><span className="font-mono font-bold">{metrics.find(m => m.id === 'mi_count')?.weekOfJul13 ?? '—'}</span></Field>
              <Field label="Alert_Detection"><span className="font-mono font-bold">{metrics.find(m => m.id === 'mi_detection')?.weekOfJul13 ?? '—'}</span></Field>
              <Field label="Window_Closed_At"><span className="font-mono">2026-07-20 07:00:14Z</span></Field>
              <Field label="Report_Doc_Url"><span className="font-mono text-tech">ITSM-Weekly-{formData.reportWeek}.docx</span></Field>
              <Field label="Active priorities"><span className="font-mono font-bold text-brand-deep">{act.length}</span></Field>
              <Field label="Completed"><span className="font-mono font-bold text-ok-deep">{comp.length}</span></Field>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider">Created / Modified</div>
              <div className="text-[12px] text-ink-soft font-mono">by <span className="text-ink font-semibold">Power Automate (Flow Bot)</span> · 2026-07-20 07:00:14Z · Version 1.0</div>
            </div>

            <div className="space-y-3 pt-2 border-t border-line">
              <CodePanel id="items" title="Items_JSON · round-trip source" body={itemsJson} />
              <CodePanel id="remarks" title="Metrics_Analysis · Remarks (prose)" body={committed || '(no remarks committed)'} prose />
              <CodePanel id="metrics" title="Metrics_JSON · KPI snapshot" body={metricsJson} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import {
  FlowCardFormData, FlowItem, PillarType, RagStatus, PILLARS,
  activeItems, completedItems, archivedItems, itemsByPillar,
} from '../types/itsm';
import { RecalcMetric, ragDot, ragChip } from '../utils/rag-ui';
import { EtaEditor, EtaChip } from './EtaEditor';
import { AddPriorityComposer } from './AddPriorityComposer';
import { LifecycleRail } from './LifecycleRail';
import {
  Users, Cpu, Clock, Check, Archive, Undo2, Trash2, Copy,
  Sparkles, Bot, GitBranch, Lock, Flame, CheckCheck,
  HelpCircle, Info, ArrowRight,
} from 'lucide-react';

interface Props {
  formData: FlowCardFormData;
  setFormData: React.Dispatch<React.SetStateAction<FlowCardFormData>>;
  overall: RagStatus;
  metrics: RecalcMetric[];
  phase: 'open' | 'closed';
  locked: boolean;
  nowMs: number; openMs: number; closeMs: number;
  onCloseWindow: () => void; onNewWeek: () => void;
  onGotoReport: () => void;
}

const PILLAR_META: Record<PillarType, { Icon: React.ElementType; icon: string }> = {
  People: { Icon: Users, icon: 'text-brand' },
  Process: { Icon: Clock, icon: 'text-xv-slate' },
  Technology: { Icon: Cpu, icon: 'text-tech' },
};

const RAG_OPT: { key: RagStatus; dot: string; label: string }[] = [
  { key: 'green', dot: 'bg-ok', label: 'Green' },
  { key: 'yellow', dot: 'bg-warn', label: 'Yellow' },
  { key: 'red', dot: 'bg-crit', label: 'Red' },
];

const RagMini: React.FC<{ value: RagStatus; onChange: (r: RagStatus) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <div className="flex items-center bg-paper rounded-lg p-0.5 border border-line gap-0.5 shadow-sm">
    {RAG_OPT.map(o => {
      const on = value === o.key;
      return (
        <button key={o.key} type="button" disabled={disabled} onClick={() => onChange(o.key)} title={o.label}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition border ${
            on ? 'bg-white text-ink border-line shadow-sm' : 'text-ink-soft border-transparent hover:text-ink hover:bg-white/60'
          } disabled:opacity-40`}>
          <span className={`w-2 h-2 rounded-full ${on ? o.dot : 'bg-line'}`} /> {o.label}
        </button>
      );
    })}
  </div>
);

const worst = (rags: RagStatus[]): RagStatus => (rags.includes('red') ? 'red' : rags.includes('yellow') ? 'yellow' : rags.length ? 'green' : 'na');

export const TeamsFlowCardStudio: React.FC<Props> = (p) => {
  const { formData, setFormData, overall, metrics, locked } = p;
  const [section, setSection] = useState<'both' | 's1' | 's2'>('both');
  const [copied, setCopied] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showTour, setShowTour] = useState(true);
  // Lifted per-row state: which inline ETA editors are open. Lives here (not in a
  // per-row component) so it survives the re-renders the 1 Hz window clock causes.
  const [openEta, setOpenEta] = useState<Record<string, boolean>>({});
  const toggleEta = (id: string) => setOpenEta(s => ({ ...s, [id]: !s[id] }));

  const active = activeItems(formData.items);
  const completed = completedItems(formData.items);
  const archived = archivedItems(formData.items);

  const patch = (id: string, d: Partial<FlowItem>) => setFormData(s => ({ ...s, items: s.items.map(i => i.id === id ? { ...i, ...d } : i) }));
  const remove = (id: string) => setFormData(s => ({ ...s, items: s.items.filter(i => i.id !== id) }));
  // Default team for new items — derived from the first item in the dataset,
  // or 'ingram' if empty. This lets each team's FlowCard tag new items correctly.
  const defaultTeam = formData.items[0]?.team ?? 'ingram';
  const add = (pillar: PillarType, text: string, eta: string, rag: RagStatus) =>
    setFormData(s => ({ ...s, items: [...s.items, { id: `n${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, pillar, text, eta, rag, complete: false, archived: false, origin: 'new', team: defaultTeam }] }));
  const copy = () => { navigator.clipboard.writeText(JSON.stringify(formData, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  const orbOuter = overall === 'green' ? 'from-ok-soft to-ok/25 border-ok/60' : overall === 'yellow' ? 'from-warn-soft to-warn/25 border-warn/60' : 'from-crit-soft to-crit/25 border-crit/60';
  const orbInner = overall === 'green' ? 'bg-ok' : overall === 'yellow' ? 'bg-warn' : 'bg-crit';
  const orbLabel = overall === 'green' ? 'text-ok-deep' : overall === 'yellow' ? 'text-warn-deep' : 'text-crit-deep';

  const drivers = [
    ...active.filter(i => i.rag === 'red' || i.rag === 'yellow').map(i => ({ rag: i.rag, label: i.text.length > 46 ? i.text.slice(0, 46) + '…' : i.text, kind: 'item' as const })),
    ...metrics.filter(m => m.rag === 'red' || m.rag === 'yellow').map(m => ({ rag: m.rag, label: m.metric, kind: 'metric' as const })),
  ];
  const nRed = drivers.filter(d => d.rag === 'red').length;

  const matrix = [
    { label: '§1 People', rag: worst(itemsByPillar(completed, 'People').map(i => i.rag)) },
    { label: '§1 Process', rag: worst(itemsByPillar(completed, 'Process').map(i => i.rag)) },
    { label: '§1 Tech', rag: worst(itemsByPillar(completed, 'Technology').map(i => i.rag)) },
    { label: '§2 People', rag: worst(itemsByPillar(active, 'People').map(i => i.rag)) },
    { label: '§2 Process', rag: worst(itemsByPillar(active, 'Process').map(i => i.rag)) },
    { label: '§2 Tech', rag: worst(itemsByPillar(active, 'Technology').map(i => i.rag)) },
  ];

  const miRow = metrics.find(m => m.id === 'mi_count');
  const alertRow = metrics.find(m => m.id === 'mi_detection');

  // ── Row render helpers ──────────────────────────────────────────────────
  // These are *plain functions that return JSX*, called inline — NOT nested
  // components. The distinction is the whole fix: a nested component gets a
  // fresh identity on every parent render, so React unmounts/remounts each row
  // every tick (replaying the `animate-fade-up` entrance as a visible pulse, and
  // nuking focus / per-row state). A function call returns elements that React
  // reconciles *in place* by the key on their root, so the entrance animation
  // plays exactly once — on genuine appearances (a new item, a tab switch) — and
  // never on the 1 Hz clock tick or on a keystroke.
  const renderActiveRow = (it: FlowItem) => {
    const m = PILLAR_META[it.pillar];
    const etaOpen = !!openEta[it.id];
    return (
      <div key={it.id} className="group flex items-start gap-2.5 p-2.5 rounded-lg border border-line bg-paper hover:border-brand/40 hover:shadow-sm transition animate-fade-up">
        <div className="mt-0.5 shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-mist text-ink-soft">
          <m.Icon className={`w-3.5 h-3.5 ${m.icon}`} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <textarea rows={2} value={it.text} disabled={locked} onChange={e => patch(it.id, { text: e.target.value })}
            placeholder="Describe the priority…"
            className="w-full bg-paper border border-line rounded-md p-2 text-xs text-ink focus:ring-2 focus:ring-brand focus:border-brand transition leading-relaxed resize-y disabled:opacity-60 font-body" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {it.origin === 'new' && <span className="text-[9px] font-mono font-bold bg-brand-soft text-brand-deep border border-brand/30 px-1.5 py-0.5 rounded">＋ NEW</span>}
            <EtaChip value={it.eta} interactive={!locked} onClick={() => toggleEta(it.id)} />
            <button type="button" disabled={locked} onClick={() => remove(it.id)} title="Delete"
              className="ml-auto text-line hover:text-crit opacity-0 group-hover:opacity-100 transition disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          {etaOpen && (
            <div className="pt-1 border-t border-line/70 animate-fade-up">
              <EtaEditor variant="compact" value={it.eta} onChange={v => patch(it.id, { eta: v })} disabled={locked} placeholder="e.g. Mid Q3, TBD…" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <RagMini value={it.rag} disabled={locked} onChange={r => patch(it.id, { rag: r })} />
          <button type="button" disabled={locked} onClick={() => patch(it.id, { complete: true })}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md bg-ok-soft text-ok-deep border border-ok/40 hover:bg-ok hover:text-white transition disabled:opacity-40 active:scale-95 font-sans">
            <Check className="w-3.5 h-3.5" /> Complete
          </button>
        </div>
      </div>
    );
  };

  const renderCompletedRow = (it: FlowItem) => {
    return (
      <div key={it.id} className="group flex items-start gap-2.5 p-2.5 rounded-lg border border-ok/40 bg-paper transition animate-fade-up">
        <div className="mt-0.5 shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-ok-soft text-ok-deep">
          <Check className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs text-ink leading-relaxed font-body">{it.text}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {it.origin === 'new' && <span className="text-[9px] font-mono font-bold bg-brand-soft text-brand-deep border border-brand/30 px-1.5 py-0.5 rounded">＋ NEW</span>}
            <EtaChip value={it.eta} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button type="button" disabled={locked} onClick={() => patch(it.id, { archived: true })}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md bg-mist text-ink-soft border border-line hover:bg-xv-soft hover:text-xv-deep transition disabled:opacity-40 active:scale-95 font-sans">
            <Archive className="w-3 h-3" /> Archive
          </button>
          <button type="button" disabled={locked} onClick={() => patch(it.id, { complete: false })} title="Send back to priorities"
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md text-brand-deep hover:bg-brand-soft transition disabled:opacity-40 active:scale-95 font-sans">
            <Undo2 className="w-3 h-3" /> Reopen
          </button>
        </div>
      </div>
    );
  };

  const renderPillarGroup = (pillar: PillarType, mode: 'active' | 'completed') => {
    const m = PILLAR_META[pillar];
    const list = itemsByPillar(mode === 'active' ? active : completed, pillar);
    const roll = worst(list.map(i => i.rag));
    return (
      <div key={pillar} className="space-y-2">
        <div className="flex items-center gap-1.5">
          <m.Icon className={`w-3.5 h-3.5 ${m.icon}`} />
          <span className="text-[11px] font-extrabold text-ink font-display uppercase tracking-wide">{pillar}</span>
          <span className="text-[10px] font-mono text-ink-soft">({list.length})</span>
          {mode === 'active' && list.length > 0 && roll !== 'na' && (
            <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${ragChip(roll)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ragDot(roll)}`} />{roll.toUpperCase()}
            </span>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-[11px] text-ink-soft italic pl-1 py-1 font-body">
            {mode === 'completed' ? 'Nothing closed yet here — tick “Complete” on a priority above and it lands in this pillar.' : 'No active priorities in this pillar.'}
          </p>
        ) : (
          <div className="space-y-1.5">{list.map(it => mode === 'active' ? renderActiveRow(it) : renderCompletedRow(it))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="stripes panel-soft rounded-2xl p-8 sm:p-10 relative overflow-hidden reveal">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand to-brand-deep" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/80 border border-line text-[11px] font-bold font-mono text-brand-deep uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-brand" /> MS Teams FlowCard
              </span>
              <span className={`text-xs font-mono flex items-center gap-1.5 ${locked ? 'text-crit-deep' : 'text-ink-soft'}`}>
                <span className={`w-2 h-2 rounded-full ${locked ? 'bg-crit' : 'bg-ok dot-live'}`} />
                {locked ? 'Closed for submission' : 'Flow Bot · window open'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight leading-tight">
              A weekly card that carries work forward — and locks on time
            </h2>
            <p className="text-sm text-ink-soft/90 leading-relaxed font-body max-w-xl">
              Last week's open priorities are already here. Tick <strong className="text-ok-deep">Complete</strong> to close one, set its <strong className="text-ink">RAG</strong> and <strong className="text-ink">ETA</strong> inline, or open the single <strong className="text-brand-deep">Add a priority</strong> composer for net-new work. Final distribution happens on the Executive Report tab.
            </p>
            <button onClick={() => setShowTour(v => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-brand hover:text-brand-deep transition mt-1">
              <HelpCircle className="w-3.5 h-3.5" /> {showTour ? 'Hide the 2-minute submitter guide' : 'Show the 2-minute submitter guide'}
            </button>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono text-ink-soft uppercase tracking-widest">Auto</span>
            <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${orbOuter} border-4 flex items-center justify-center shadow-xl`}>
              <div className={`w-14 h-14 rounded-full ${orbInner} shadow-lg`} />
            </div>
            <span className={`text-base font-extrabold font-display tracking-wide ${orbLabel}`}>{overall.toUpperCase()}</span>
            <span className="text-[10px] font-mono text-ink-soft lowercase">{nRed} critical · {drivers.length} drivers</span>
          </div>
        </div>
      </section>

      {/* Submitter guide */}
      {showTour && (
        <div className="panel p-6 bg-gradient-to-r from-brand-soft/50 via-paper to-tech-soft/30 border-2 border-brand/20 rounded-2xl relative overflow-hidden reveal">
          <button onClick={() => setShowTour(false)} className="absolute top-3 right-3 text-ink-soft hover:text-ink text-xs font-bold font-mono">✕</button>
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-line">
            <Info className="w-4 h-4 text-brand" />
            <h3 className="text-xs font-extrabold text-brand-deep uppercase tracking-wider font-display">The submitter's 2-minute Monday</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
            {[
              { n: 1, t: 'It arrives pre-filled', b: <>The card lands in Teams on Monday 08:00 with every open priority already listed — nothing to copy from last week. Finished last week? It's sitting in <strong className="text-ink">Section 1</strong> waiting for an Archive tick.</> },
              { n: 2, t: 'Audit by clicking, not typing', b: <>Tick <strong className="text-ok-deep">Complete</strong> and a priority jumps to Section 1. Nudge a <strong className="text-ink">RAG</strong> or an <strong className="text-ink">ETA</strong> (a date, <em>Q4</em>, <em>Mid Q3</em>, <em>TBD</em>) inline. Net-new work goes through one <strong className="text-brand-deep">Add a priority</strong> composer up top.</> },
              { n: 3, t: 'Finalize on the Report tab', b: <>When the items look right, jump to <strong className="text-ink">Executive Report</strong>, type in the KPIs, and press <strong className="text-ink">Finalize</strong> — the digest goes to Outlook and the snapshot to SharePoint in one click.</> },
            ].map(s => (
              <div key={s.n} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-pine text-on-navy flex items-center justify-center font-mono font-bold text-[10px]">{s.n}</span>
                  <h4 className="font-bold text-ink font-display">{s.t}</h4>
                </div>
                <p className="text-ink-soft font-body">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* FlowCard device */}
        <div className="lg:col-span-8">
          <div className={`bg-paper border-2 border-navy rounded-2xl shadow-2xl overflow-hidden relative ${locked ? 'ring-2 ring-crit/40' : ''}`}>
            {locked && (
              <div className="absolute inset-x-0 top-0 z-20 bg-crit text-white text-[11px] font-mono font-bold px-4 py-2 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> CLOSED FOR SUBMISSION · inputs locked · finalized to SharePoint · reopens Mon 08:00
              </div>
            )}
            {/* Teams channel bar */}
            <div className={`bg-navy px-4 py-3 flex items-center justify-between text-on-navy border-b border-navy-line flex-wrap gap-2 ${locked ? 'mt-8' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center font-bold text-xs text-white shadow">T</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs font-display text-on-navy">ITSM Operations &amp; Governance</span>
                    <span className="bg-navy-soft text-on-navy text-[10px] px-1.5 py-0.5 rounded font-mono">Teams Channel</span>
                  </div>
                  <span className="text-[11px] text-on-navy-soft flex items-center gap-1.5 font-mono">
                    <span className={`w-2 h-2 rounded-full ${locked ? 'bg-crit' : 'bg-ok animate-pulse'}`} /> Power Automate Flow Bot · {locked ? 'Closed' : 'Online'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-navy-deep p-1 rounded-lg text-xs font-mono">
                {([['both', 'All Sections'], ['s1', '1. Completed'], ['s2', '2. Priorities']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setSection(k)}
                    className={`px-2.5 py-1 rounded transition ${section === k ? 'bg-brand text-white font-bold border border-brand-bright/50' : 'text-on-navy-soft hover:text-on-navy border border-transparent'}`}>{l}</button>
                ))}
              </div>
            </div>

            {/* Chat body */}
            <div className="bg-mist/60 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center shrink-0 shadow border border-navy-line">
                  <Bot className="w-5 h-5 text-brand-bright" />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-ink font-display">Power Automate Flow Bot</span>
                    <span className="text-[10px] bg-navy text-on-navy px-1.5 py-0.5 rounded font-mono font-semibold">BOT</span>
                    <span className="text-[11px] text-ink-soft font-mono">Posted Mon 08:00 · seeded from last week</span>
                  </div>

                  <div className="bg-paper border-2 border-navy rounded-xl p-5 shadow-lg space-y-5">
                    {/* header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-line">
                      <div>
                        <h3 className="text-base font-extrabold text-ink font-display flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-brand" /> ITSM Weekly Status FlowCard
                        </h3>
                        <p className="text-xs text-ink-soft font-mono">Ingram Micro · {formData.reportWeek}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-mist px-2.5 py-1 rounded-lg border border-line text-xs font-mono">
                          <span className="text-[10px] text-ink-soft block font-semibold">REPORT WEEK</span>
                          <input type="text" value={formData.reportWeek} disabled={locked}
                            onChange={e => setFormData(s => ({ ...s, reportWeek: e.target.value }))}
                            className="bg-transparent text-ink font-bold text-xs focus:outline-none w-36 disabled:opacity-60" />
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 ${ragChip(overall)}`}>
                          <span className="text-[10px] opacity-70">✨ AUTO</span>
                          <span className={`w-2 h-2 rounded-full ${ragDot(overall)}`} /> {overall.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Section 1 */}
                    {(section === 'both' || section === 's1') && (
                      <div className="panel p-4 space-y-3.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-ok text-white font-bold text-xs flex items-center justify-center">✓</span>
                            <div>
                              <h4 className="text-xs font-extrabold text-ok-deep uppercase tracking-wider font-display">Section 1 · Completed</h4>
                              <p className="text-[11px] text-ink-soft font-body">Closed work · tick Archive to retire it for good</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono bg-ok-soft text-ok-deep border border-ok/40 px-2 py-0.5 rounded font-semibold">{completed.length} closed</span>
                        </div>
                        {PILLARS.map(pl => renderPillarGroup(pl, 'completed'))}
                        {archived.length > 0 && (
                          <div className="pt-2 border-t border-line">
                            <button onClick={() => setShowArchived(v => !v)} className="text-[10px] font-mono text-ink-soft hover:text-ink flex items-center gap-1">
                              <Archive className="w-3 h-3" /> {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
                            </button>
                            {showArchived && (
                              <div className="mt-2 space-y-1">
                                {archived.map(it => (
                                  <div key={it.id} className="flex items-center gap-2 text-[11px] text-ink-soft bg-xv-soft/50 border border-xv/30 rounded px-2 py-1">
                                    <span className="line-through flex-1 truncate font-body">{it.text}</span>
                                    <button disabled={locked} onClick={() => patch(it.id, { archived: false })} className="text-brand-deep hover:underline font-bold inline-flex items-center gap-0.5 disabled:opacity-40"><Undo2 className="w-3 h-3" /> restore</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section 2 */}
                    {(section === 'both' || section === 's2') && (
                      <div className="panel p-4 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-brand text-white font-bold text-xs flex items-center justify-center">📌</span>
                            <div>
                              <h4 className="text-xs font-extrabold text-brand-deep uppercase tracking-wider font-display">Section 2 · Current Priorities</h4>
                              <p className="text-[11px] text-ink-soft font-body">Last week's open work, plus anything you add</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono bg-brand-soft text-brand-deep border border-brand/40 px-2 py-0.5 rounded font-semibold">{active.length} active</span>
                        </div>

                        {/* single composer at the top of all categories */}
                        <AddPriorityComposer disabled={locked} onLog={add} />

                        <div className="space-y-4 pt-1">
                          {PILLARS.map(pl => renderPillarGroup(pl, 'active'))}
                        </div>
                      </div>
                    )}

                    {/* footer — read-only KPIs + copy + jump to finalize */}
                    <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-ink-soft font-mono flex-wrap">
                        <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-crit" /> MIs <strong className="text-ink">{miRow?.weekOfJul13 ?? '—'}</strong></span>
                        <span className="text-line">·</span>
                        <span className="flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5 text-ok" /> Alerting <strong className="text-ink">{alertRow?.weekOfJul13 ?? '—'}</strong></span>
                        <span className="hidden sm:inline text-[10px] text-ink-soft/80 font-body">· KPIs are typed on the Report tab</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={copy}
                          className="inline-flex items-center px-3 py-2 text-xs font-bold rounded-lg bg-mist hover:bg-line/60 text-ink border border-line transition font-mono active:scale-[0.98]">
                          <Copy className="w-3.5 h-3.5 mr-1.5 text-brand" /> {copied ? 'Copied!' : 'Copy payload'}
                        </button>
                        <button type="button" onClick={p.onGotoReport}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-brand to-brand-bright hover:from-brand-deep hover:to-brand text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition active:scale-[0.98] font-display">
                          Enter KPIs &amp; Finalize <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: lifecycle + RAG engine (bus lives on the Report tab now) */}
        <div className="lg:col-span-4 space-y-4">
          <LifecycleRail phase={p.phase} nowMs={p.nowMs} openMs={p.openMs} closeMs={p.closeMs} onClose={p.onCloseWindow} onNewWeek={p.onNewWeek} />

          <div className="panel p-5 space-y-3">
            <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-2 font-display">
              <GitBranch className="w-4 h-4 text-brand" /> Overall RAG Engine
            </h4>
            <div className="bg-mist border border-line rounded-lg p-3 font-mono text-[11px] leading-relaxed text-ink">
              <div><span className="text-ink-soft">worst of</span> (active items ∪ KPIs)</div>
              <div><span className="text-ink-soft">if</span> any = <span className="text-crit font-bold">RED</span> ⇒ <span className="text-crit font-bold">RED</span></div>
              <div><span className="text-ink-soft">else if</span> <span className="text-warn font-bold">YELLOW</span> ⇒ <span className="text-warn font-bold">YELLOW</span> · <span className="text-ink-soft">else</span> <span className="text-ok font-bold">GREEN</span></div>
              <div className="text-ink-soft pt-1">completed &amp; archived excluded</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              {matrix.map(m => (
                <div key={m.label} className="flex items-center justify-between bg-paper p-1.5 rounded border border-line">
                  <span className="text-ink font-semibold truncate">{m.label}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${ragDot(m.rag)}`} />
                </div>
              ))}
            </div>
            <div>
              <div className="text-[10px] font-mono text-ink-soft uppercase tracking-wider mb-1.5">Live drivers ({drivers.length})</div>
              {drivers.length === 0 ? (
                <p className="text-[11px] text-ok-deep bg-ok-soft border border-ok/40 rounded px-2 py-1.5 font-body">No reds or yellows — all clear.</p>
              ) : (
                <div className="space-y-1 max-h-44 overflow-y-auto scrollbar-thin pr-1">
                  {drivers.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] bg-paper border border-line rounded px-2 py-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ragDot(d.rag)}`} />
                      <span className="text-ink truncate flex-1 font-body">{d.label}</span>
                      <span className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded ${d.kind === 'metric' ? 'bg-tech-soft text-tech' : 'bg-mist text-ink-soft'}`}>{d.kind === 'metric' ? 'KPI' : 'ITEM'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

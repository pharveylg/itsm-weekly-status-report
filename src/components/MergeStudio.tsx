import React, { useMemo, useState } from 'react';
import {
  FlowCardFormData, FlowItem, MergedItem, PillarType, RagStatus, TeamId,
  PILLARS, TEAMS, teamMeta,
} from '../types/itsm';
import { ragDot, ragChip } from '../utils/rag-ui';
import { BrandLockup } from './BrandLockup';
import {
  Check, X, Link2, ChevronDown, ChevronRight, Users, Clock, Cpu,
  GitMerge, CheckCircle2, AlertTriangle, Eye, Pencil, ArrowRight,
} from 'lucide-react';

interface Props {
  ingramData: FlowCardFormData;
  capgeminiData: FlowCardFormData;
  mergedItems: MergedItem[];
  setMergedItems: React.Dispatch<React.SetStateAction<MergedItem[]>>;
  onGotoReport: () => void;
}

const PILLAR_META: Record<PillarType, { Icon: React.ElementType; icon: string }> = {
  People: { Icon: Users, icon: 'text-brand' },
  Process: { Icon: Clock, icon: 'text-xv-slate' },
  Technology: { Icon: Cpu, icon: 'text-tech' },
};

const OwnershipChip: React.FC<{ ownership: MergedItem['ownership'] }> = ({ ownership }) => {
  if (ownership === 'shared') return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-warn-soft text-warn-deep border border-warn/30"><Link2 className="w-2.5 h-2.5" /> SHARED</span>;
  const t = teamMeta(ownership as TeamId);
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${t.chip}`}>{t.short}</span>;
};

const StatusBadge: React.FC<{ status: MergedItem['status'] }> = ({ status }) => {
  if (status === 'accepted') return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-ok-soft text-ok-deep border border-ok/40"><Check className="w-2.5 h-2.5" /> Accepted</span>;
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-crit-soft text-crit-deep border border-crit/40"><X className="w-2.5 h-2.5" /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-warn-soft text-warn-deep border border-warn/40"><Eye className="w-2.5 h-2.5" /> Pending</span>;
};

export const MergeStudio: React.FC<Props> = ({ mergedItems, setMergedItems, onGotoReport }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const accepted = mergedItems.filter(m => m.status === 'accepted').length;
    const rejected = mergedItems.filter(m => m.status === 'rejected').length;
    const pending = mergedItems.filter(m => m.status === 'pending').length;
    const shared = mergedItems.filter(m => m.ownership === 'shared').length;
    return { accepted, rejected, pending, shared, total: mergedItems.length };
  }, [mergedItems]);

  const allAccepted = stats.pending === 0 && stats.total > 0;

  const patchMerged = (mergeId: string, d: Partial<MergedItem>) =>
    setMergedItems(prev => prev.map(m => m.mergeId === mergeId ? { ...m, ...d } : m));

  const acceptAll = () => setMergedItems(prev => prev.map(m => m.status === 'pending' ? { ...m, status: 'accepted' } : m));

  const renderTeamSide = (item: FlowItem | undefined, team: TeamId) => {
    if (!item) return <p className="text-[11px] text-ink-soft italic">No entry from {teamMeta(team).label}</p>;
    const t = teamMeta(team);
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${t.dot}`} />
          <span className="text-[10px] font-mono font-bold" style={{ color: 'inherit' }}>{t.label}</span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${ragChip(item.rag)}`}><span className={`w-1.5 h-1.5 rounded-full ${ragDot(item.rag)}`} />{item.rag.toUpperCase()}</span>
        </div>
        <p className="text-[12px] text-ink leading-relaxed font-body pl-3.5 border-l-2 border-line">{item.text}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="stripes panel-soft rounded-2xl p-8 sm:p-10 relative overflow-hidden reveal">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand to-tech" />
        <div className="relative z-10 flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line/70">
          <BrandLockup />
          <span className="text-[10px] font-mono text-ink-soft bg-white/70 border border-line rounded px-2 py-1">merge studio · reconciliation</span>
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/80 border border-line text-[11px] font-bold font-mono text-brand-deep uppercase tracking-wider">
                <GitMerge className="w-3.5 h-3.5 text-brand" /> Merge Studio
              </span>
              {TEAMS.map(t => (
                <span key={t.id} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${t.chip}`}>
                  <span className={`w-2 h-2 rounded-full ${t.dot}`} /> {t.label}
                </span>
              ))}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight leading-tight">
              Reconcile two teams into one report
            </h2>
            <p className="text-sm text-ink-soft/90 leading-relaxed font-body max-w-xl">
              Ingram and Capgemini each filed their updates independently. Shared items show side-by-side RAGs. Accept or reject each line — only accepted items make it into the final report.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-ok-soft border border-ok/40 rounded-lg px-3 py-2">
                <div className="text-lg font-extrabold text-ok-deep font-display">{stats.accepted}</div>
                <div className="text-[9px] font-mono text-ok-deep uppercase">Accepted</div>
              </div>
              <div className="bg-warn-soft border border-warn/40 rounded-lg px-3 py-2">
                <div className="text-lg font-extrabold text-warn-deep font-display">{stats.pending}</div>
                <div className="text-[9px] font-mono text-warn-deep uppercase">Pending</div>
              </div>
              <div className="bg-crit-soft border border-crit/40 rounded-lg px-3 py-2">
                <div className="text-lg font-extrabold text-crit-deep font-display">{stats.rejected}</div>
                <div className="text-[9px] font-mono text-crit-deep uppercase">Rejected</div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-ink-soft">{stats.shared} shared · {stats.total} total</span>
          </div>
        </div>
      </section>

      {/* Gate controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={acceptAll} disabled={stats.pending === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold font-display bg-ok hover:bg-ok-deep text-white shadow-md shadow-ok/30 border border-ok-deep/40 transition active:scale-[0.98] disabled:opacity-40">
            <CheckCircle2 className="w-3.5 h-3.5" /> Accept all pending ({stats.pending})
          </button>
          {allAccepted && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-ok-deep font-mono bg-ok-soft border border-ok/40 rounded-lg px-3 py-1.5 animate-fade-up">
              <Check className="w-3.5 h-3.5" /> All items reviewed — ready to finalize
            </span>
          )}
        </div>
        {allAccepted && (
          <button onClick={onGotoReport}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-brand to-brand-bright hover:from-brand-deep hover:to-brand text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition active:scale-[0.98] font-display">
            Enter KPIs & Finalize <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Merged items by pillar */}
      {PILLARS.map(pillar => {
        const items = mergedItems.filter(m => m.pillar === pillar);
        if (items.length === 0) return null;
        const pm = PILLAR_META[pillar];
        return (
          <div key={pillar} className="panel p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-line">
              <pm.Icon className={`w-4 h-4 ${pm.icon}`} />
              <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">{pillar}</h3>
              <span className="text-[10px] font-mono text-ink-soft ml-auto">{items.length} items</span>
            </div>

            <div className="space-y-2">
              {items.map(mi => {
                const open = expandedId === mi.mergeId;
                return (
                  <div key={mi.mergeId} className={`rounded-xl border transition ${
                    mi.status === 'accepted' ? 'border-ok/40 bg-ok-soft/20'
                    : mi.status === 'rejected' ? 'border-crit/40 bg-crit-soft/20 opacity-60'
                    : 'border-line bg-paper hover:border-brand/40'
                  }`}>
                    {/* Summary row */}
                    <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(open ? null : mi.mergeId)}>
                      <button className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition shrink-0 ${open ? 'bg-brand text-white border-brand' : 'bg-paper text-ink-soft border-line'}`}>
                        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-[12.5px] text-ink font-body leading-relaxed">{mi.text}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <OwnershipChip ownership={mi.ownership} />
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${ragChip(mi.rag)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ragDot(mi.rag)}`} /> {mi.rag.toUpperCase()}
                          </span>
                          {mi.complete && <span className="text-[9px] font-mono font-bold bg-ok-soft text-ok-deep border border-ok/40 px-1.5 py-0.5 rounded">✓ COMPLETED</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={mi.status} />
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {open && (
                      <div className="px-3 pb-3 pt-0 space-y-3 border-t border-line/70 animate-fade-up">
                        {/* Side-by-side team views */}
                        {mi.ownership === 'shared' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {renderTeamSide(mi.ingram, 'ingram')}
                            {renderTeamSide(mi.capgemini, 'capgemini')}
                          </div>
                        )}

                        {/* Editable reconciled text */}
                        <div className="space-y-1 pt-1">
                          <label className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Reconciled text (goes into the final report)
                          </label>
                          <textarea rows={2} value={mi.text}
                            onChange={e => patchMerged(mi.mergeId, { text: e.target.value })}
                            className="w-full bg-paper border border-line rounded-lg p-2.5 text-xs text-ink focus:ring-2 focus:ring-brand focus:border-brand transition font-body leading-relaxed resize-y" />
                        </div>

                        {/* RAG override */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider">Final RAG</span>
                          <div className="flex items-center gap-1 bg-mist rounded-lg p-0.5 border border-line/70">
                            {(['green', 'yellow', 'red'] as RagStatus[]).map(r => {
                              const on = mi.rag === r;
                              return (
                                <button key={r} type="button" onClick={() => patchMerged(mi.mergeId, { rag: r })}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition border ${on ? 'bg-white text-ink border-line shadow-sm' : 'text-ink-soft border-transparent hover:text-ink'}`}>
                                  <span className={`w-2 h-2 rounded-full ${on ? ragDot(r) : 'bg-line'}`} /> {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Accept / Reject gate */}
                        <div className="flex items-center gap-2 pt-1 border-t border-line">
                          <button onClick={() => patchMerged(mi.mergeId, { status: 'accepted' })}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition active:scale-95 ${mi.status === 'accepted' ? 'bg-ok text-white' : 'bg-ok-soft text-ok-deep border border-ok/40 hover:bg-ok hover:text-white'}`}>
                            <Check className="w-3.5 h-3.5" /> Accept
                          </button>
                          <button onClick={() => patchMerged(mi.mergeId, { status: 'rejected' })}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition active:scale-95 ${mi.status === 'rejected' ? 'bg-crit text-white' : 'bg-crit-soft text-crit-deep border border-crit/40 hover:bg-crit hover:text-white'}`}>
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                          <button onClick={() => patchMerged(mi.mergeId, { status: 'pending' })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-paper border border-line text-ink-soft hover:text-ink transition active:scale-95">
                            Reset to pending
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {stats.pending > 0 && (
        <div className="bg-warn-soft border border-warn/40 rounded-xl p-4 flex items-center gap-3 animate-fade-up">
          <AlertTriangle className="w-5 h-5 text-warn-deep shrink-0" />
          <div>
            <div className="text-sm font-bold text-warn-deep font-display">{stats.pending} item{stats.pending > 1 ? 's' : ''} still pending review</div>
            <p className="text-[12px] text-warn-deep/80 font-body">Accept or reject every item before the merged report can be finalized.</p>
          </div>
        </div>
      )}
    </div>
  );
};

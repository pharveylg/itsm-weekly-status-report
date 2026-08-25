import React, { useEffect, useRef, useState } from 'react';
import { PillarType, RagStatus } from '../types/itsm';
import { EtaEditor } from './EtaEditor';
import { Plus, X, CornerDownLeft, Users, Clock, Cpu } from 'lucide-react';

interface Props {
  disabled?: boolean;
  onLog: (pillar: PillarType, text: string, eta: string, rag: RagStatus) => void;
}

const PILLAR_OPT: { key: PillarType; label: string; Icon: React.ElementType; icon: string }[] = [
  { key: 'People', label: 'People', Icon: Users, icon: 'text-brand' },
  { key: 'Process', label: 'Process', Icon: Clock, icon: 'text-xv-slate' },
  { key: 'Technology', label: 'Technology', Icon: Cpu, icon: 'text-tech' },
];

const RAG_OPT: { key: RagStatus; dot: string; label: string }[] = [
  { key: 'green', dot: 'bg-ok', label: 'Green' },
  { key: 'yellow', dot: 'bg-warn', label: 'Yellow' },
  { key: 'red', dot: 'bg-crit', label: 'Red' },
];

export const AddPriorityComposer: React.FC<Props> = ({ disabled, onLog }) => {
  const [open, setOpen] = useState(false);
  const [pillar, setPillar] = useState<PillarType>('Technology');
  const [text, setText] = useState('');
  const [eta, setEta] = useState('');
  const [rag, setRag] = useState<RagStatus>('green');

  const wrapRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // click-outside + Escape, only while open
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => taRef.current?.focus(), 60);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open]);

  const reset = () => { setText(''); setEta(''); setRag('green'); };
  const log = () => {
    if (!text.trim()) { taRef.current?.focus(); return; }
    onLog(pillar, text.trim(), eta.trim(), rag);
    reset();
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      {/* the single wide trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed transition font-display font-bold text-xs tracking-wide active:scale-[0.99] ${
          open
            ? 'border-brand bg-brand-soft text-brand-deep'
            : 'border-line bg-paper/60 text-ink-soft hover:border-brand/60 hover:text-brand-deep hover:bg-brand-soft/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {open ? 'Cancel new priority' : 'Add a priority'}
        <span className="hidden sm:inline font-mono font-medium text-[10px] opacity-70">· logged to the pillar you pick below</span>
      </button>

      {/* inline composition card */}
      {open && (
        <div className="mt-2 panel p-4 sm:p-5 space-y-3.5 animate-fade-up ring-2 ring-brand/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-brand text-white flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></span>
              <h4 className="text-xs font-extrabold text-ink font-display uppercase tracking-wider">New priority</h4>
            </div>
            <span className="text-[10px] font-mono text-ink-soft">Esc or click outside to cancel</span>
          </div>

          {/* category picker */}
          <div>
            <div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider mb-1">Log under</div>
            <div className="inline-flex items-center bg-mist rounded-lg p-0.5 gap-0.5 border border-line/70">
              {PILLAR_OPT.map(({ key, label, Icon, icon }) => {
                const on = pillar === key;
                return (
                  <button key={key} type="button" onClick={() => setPillar(key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition border ${
                      on ? 'bg-white text-ink border-line shadow-sm' : 'text-ink-soft border-transparent hover:text-ink hover:bg-white/60'
                    }`}>
                    <Icon className={`w-3.5 h-3.5 ${on ? icon : 'opacity-60'}`} /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* description */}
          <div>
            <div className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider mb-1">What's the priority?</div>
            <textarea
              ref={taRef}
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Describe the workstream, owner, and what “done” looks like…"
              className="w-full bg-paper border border-line rounded-lg p-2.5 text-xs text-ink focus:ring-2 focus:ring-brand focus:border-brand transition leading-relaxed resize-y font-body"
            />
          </div>

          {/* ETA — directly below the entry box */}
          <EtaEditor value={eta} onChange={setEta} variant="full" placeholder="e.g. Mid Q3, TBD, after CAB…" />

          {/* RAG + actions */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1 border-t border-line">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider">Status</span>
              <div className="flex items-center bg-mist rounded-lg p-0.5 gap-0.5 border border-line/70">
                {RAG_OPT.map(o => {
                  const on = rag === o.key;
                  return (
                    <button key={o.key} type="button" onClick={() => setRag(o.key)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold transition border ${
                        on ? 'bg-white text-ink border-line shadow-sm' : 'text-ink-soft border-transparent hover:text-ink hover:bg-white/60'
                      }`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${on ? o.dot : 'bg-line'}`} /> {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { reset(); setOpen(false); }}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-mist hover:bg-line/60 text-ink border border-line transition active:scale-[0.98]">
                Cancel
              </button>
              <button type="button" onClick={log}
                disabled={!text.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-brand to-brand-bright hover:from-brand-deep hover:to-brand text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                <CornerDownLeft className="w-3.5 h-3.5" /> Log to {pillar}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

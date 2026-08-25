import React from 'react';
import { Clock, Lock, Play, FastForward, CalendarClock } from 'lucide-react';

interface Props {
  phase: 'open' | 'closed';
  nowMs: number;
  openMs: number;
  closeMs: number;
  onClose: () => void;
  onNewWeek: () => void;
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtStamp = (ms: number) => {
  const d = new Date(ms);
  return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const pad = (n: number) => String(n).padStart(2, '0');
const fmtCountdown = (ms: number) => {
  if (ms <= 0) return '00d 00h 00m 00s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(d)}d ${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
};

export const LifecycleRail: React.FC<Props> = ({ phase, nowMs, openMs, closeMs, onClose, onNewWeek }) => {
  const open = phase === 'open';
  const remaining = Math.max(0, closeMs - nowMs);
  const elapsed = Math.max(0, nowMs - openMs);
  const total = Math.max(1, closeMs - openMs);
  const progress = Math.min(100, Math.round((elapsed / total) * 100));

  return (
    <div className={`panel overflow-hidden ${open ? '' : 'ring-2 ring-crit/40'}`}>
      <div className={`terminal-titlebar px-5 py-2.5 flex items-center justify-between ${open ? '' : '!bg-crit/15 !border-crit/30'}`}>
        <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider">
          <CalendarClock className={`w-3.5 h-3.5 ${open ? 'text-brand-bright' : 'text-crit'}`} />
          <span className={open ? 'text-on-navy' : 'text-crit'}>Submission Window</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono flex items-center gap-1 border ${
          open ? 'bg-ok/20 text-ok border-ok/40' : 'bg-crit/20 text-crit border-crit/40'
        }`}>
          {open ? <span className="w-1.5 h-1.5 rounded-full bg-ok dot-live" /> : <Lock className="w-3 h-3" />}
          {open ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <div className="p-5 space-y-3.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-ink-soft">
          <span>Opened · {fmtStamp(openMs)}</span>
          <span className="text-ink">closes · {fmtStamp(closeMs)}</span>
        </div>

        {/* progress */}
        <div className="h-2 rounded-full bg-mist border border-line overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${open ? 'bg-gradient-to-r from-brand to-brand-bright' : 'bg-crit'}`}
            style={{ width: `${open ? progress : 100}%` }}
          />
        </div>

        {/* countdown / locked */}
        {open ? (
          <div className="text-center">
            <div className="text-[10px] font-mono text-ink-soft uppercase tracking-widest">closes in</div>
            <div className="font-mono text-2xl font-extrabold text-ink tabular-nums tracking-tight caret">
              {fmtCountdown(remaining)}
            </div>
          </div>
        ) : (
          <div className="text-center bg-crit-soft border border-crit/40 rounded-lg py-3 px-3">
            <div className="flex items-center justify-center gap-1.5 text-crit-deep font-display font-extrabold text-sm">
              <Lock className="w-4 h-4" /> Closed for submission
            </div>
            <div className="text-[11px] text-crit-deep/80 font-mono mt-0.5">reopens Mon 08:00</div>
          </div>
        )}

        {/* controls (demo driver) */}
        <div className="grid grid-cols-1 gap-2 pt-1">
          {open ? (
            <button onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-crit hover:bg-crit-deep text-white border border-crit-deep/40 transition active:scale-[0.98] shadow-sm">
              <FastForward className="w-3.5 h-3.5" /> Fast-forward to Mon 07:00 (close)
            </button>
          ) : (
            <button onClick={onNewWeek}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-brand hover:bg-brand-deep text-white border border-brand-deep/40 transition active:scale-[0.98] shadow-sm">
              <Play className="w-3.5 h-3.5" /> Start new week · Mon 08:00
            </button>
          )}
        </div>

        <p className="text-[11px] text-ink-soft leading-relaxed border-t border-line pt-3">
          <Clock className="w-3 h-3 inline -mt-0.5 mr-1 text-brand" />
          {open
            ? 'Card is live & editable. Toggling <strong className="text-ink">Complete</strong> bumps an item to Section 1; <strong className="text-ink">Archive</strong> retires it.'
            : 'Window shut — inputs locked and the snapshot is finalised to SharePoint. Carry-forward + closed wins seed the next card.'}
        </p>
      </div>
    </div>
  );
};

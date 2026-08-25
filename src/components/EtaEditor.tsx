import React, { useEffect, useState } from 'react';
import { Calendar, CalendarRange, Flag, Tag, X } from 'lucide-react';
import {
  sniffMode, parseQuarter, composeQuarter, etaKind, etaTone, etaLabel,
  QUICK_ETAS, PHASES, QUARTERS,
} from '../utils/eta';

type Mode = 'none' | 'date' | 'quarter' | 'free';

interface Props {
  value: string;
  onChange: (v: string) => void;
  variant?: 'full' | 'compact';
  disabled?: boolean;
  placeholder?: string;
}

const MODES: { key: Mode; label: string; Icon: React.ElementType }[] = [
  { key: 'date', label: 'Date', Icon: Calendar },
  { key: 'quarter', label: 'Quarter', Icon: CalendarRange },
  { key: 'free', label: 'Free', Icon: Tag },
];

export const EtaEditor: React.FC<Props> = ({ value, onChange, variant = 'full', disabled, placeholder }) => {
  const [mode, setMode] = useState<Mode>(() => sniffMode(value));
  const [quarter, setQuarter] = useState(() => parseQuarter(value));

  // keep quarter selects in sync if the value changes externally while in quarter mode
  useEffect(() => { if (mode === 'quarter') setQuarter(parseQuarter(value)); /* eslint-disable-next-line */ }, [value]);

  const setModeSafe = (m: Mode) => {
    setMode(m);
    if (m === 'none') onChange('');
    if (m === 'quarter' && etaKind(value) !== 'quarter') { setQuarter({ phase: '', q: '', year: '' }); onChange(''); }
    if (m === 'date' && etaKind(value) !== 'date') onChange('');
    if (m === 'free' && (etaKind(value) === 'date' || etaKind(value) === 'none')) onChange('');
  };

  const onQuarterChange = (patch: Partial<typeof quarter>) => {
    const next = { ...quarter, ...patch };
    setQuarter(next);
    onChange(composeQuarter(next.phase, next.q, next.year));
  };

  const kind = etaKind(value);
  const tone = etaTone(kind);
  const compact = variant === 'compact';

  const segCls = (m: Mode) =>
    `flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold font-mono transition border ${
      mode === m
        ? 'bg-white text-ink border-line shadow-sm'
        : 'text-ink-soft border-transparent hover:text-ink hover:bg-white/60'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

  const fieldCls =
    'bg-paper border border-line rounded-md text-ink text-[11px] focus:ring-2 focus:ring-brand focus:border-brand transition disabled:opacity-60 font-mono';

  return (
    <div className={`flex flex-col gap-1.5 ${compact ? '' : 'gap-2'}`}>
      {/* mode segmented + current value chip + clear */}
      <div className={`flex items-center gap-1.5 flex-wrap ${compact ? '' : ''}`}>
        <span className={`text-[10px] font-mono font-bold text-ink-soft uppercase tracking-wider ${compact ? '' : 'mr-0.5'}`}>ETA</span>
        <div className="flex items-center bg-mist rounded-lg p-0.5 gap-0.5 border border-line/70">
          {mode !== 'none' && (
            <button type="button" disabled={disabled} onClick={() => setModeSafe('none')} title="Clear ETA"
              className="flex items-center justify-center w-6 h-6 rounded-md text-ink-soft hover:text-crit hover:bg-white transition disabled:opacity-50">
              <X className="w-3 h-3" />
            </button>
          )}
          {MODES.map(({ key, label, Icon }) => (
            <button key={key} type="button" disabled={disabled} onClick={() => setModeSafe(key)} className={segCls(key)}>
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>

        {value && mode === 'none' && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${tone.chip}`}>
            <Flag className="w-3 h-3" /> {etaLabel(value)}
          </span>
        )}
      </div>

      {/* the active input */}
      {mode !== 'none' && (
        <div className={compact ? 'flex items-center gap-1.5 flex-wrap' : 'space-y-1.5'}>
          {mode === 'date' && (
            <input type="date" value={etaKind(value) === 'date' ? value : ''} disabled={disabled}
              onChange={e => onChange(e.target.value)}
              className={`${fieldCls} ${compact ? 'px-2 py-1 h-7' : 'px-2.5 py-1.5 w-full sm:w-56'}`} />
          )}

          {mode === 'quarter' && (
            <div className={`flex items-center gap-1.5 flex-wrap ${compact ? '' : ''}`}>
              <select value={quarter.phase} disabled={disabled} onChange={e => onQuarterChange({ phase: e.target.value })}
                className={`${fieldCls} ${compact ? 'px-1.5 py-1 h-7' : 'px-2 py-1.5'} capitalize`}>
                {PHASES.map(p => <option key={p || 'none'} value={p}>{p ? p.charAt(0).toUpperCase() + p.slice(1) : '— phase —'}</option>)}
              </select>
              <select value={quarter.q} disabled={disabled} onChange={e => onQuarterChange({ q: e.target.value })}
                className={`${fieldCls} ${compact ? 'px-1.5 py-1 h-7' : 'px-2 py-1.5'}`}>
                {QUARTERS.map(q => <option key={q || 'none'} value={q}>{q || '— quarter —'}</option>)}
              </select>
              <input type="number" min={2024} max={2040} value={quarter.year} disabled={disabled}
                placeholder="year" onChange={e => onQuarterChange({ year: e.target.value })}
                className={`metric-cell ${fieldCls} ${compact ? 'px-1.5 py-1 h-7 w-16' : 'px-2 py-1.5 w-20'}`} />
            </div>
          )}

          {mode === 'free' && (
            <div className={compact ? 'flex items-center gap-1.5 flex-wrap flex-1 min-w-0' : 'space-y-1.5'}>
              <input type="text" value={etaKind(value) === 'date' || etaKind(value) === 'none' ? '' : value} disabled={disabled}
                placeholder={placeholder || 'e.g. Mid Q3, TBD, after CAB…'}
                onChange={e => onChange(e.target.value)}
                className={`${fieldCls} ${compact ? 'px-2 py-1 h-7 flex-1 min-w-[8rem]' : 'px-2.5 py-1.5 w-full sm:w-72'}`} />
              <div className={`flex items-center gap-1 flex-wrap ${compact ? '' : 'pt-0.5'}`}>
                {QUICK_ETAS.map(q => {
                  const on = value.trim().toLowerCase() === q.toLowerCase();
                  return (
                    <button key={q} type="button" disabled={disabled} onClick={() => onChange(q)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition disabled:opacity-50 ${
                        on ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-line hover:border-brand/50 hover:text-brand-deep'
                      }`}>{q}</button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Read-only ETA chip used in rows / digests. onClick opens the inline editor. */
export const EtaChip: React.FC<{ value: string; onClick?: () => void; interactive?: boolean }> = ({ value, onClick, interactive }) => {
  const kind = etaKind(value);
  const tone = etaTone(kind);
  const Glyph = kind === 'date' ? Calendar : kind === 'quarter' ? CalendarRange : kind === 'tbd' ? Flag : kind === 'tag' ? Tag : null;
  if (kind === 'none') {
    return interactive ? (
      <button type="button" onClick={onClick}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-line text-ink-soft hover:text-brand-deep hover:border-brand/50 hover:bg-brand-soft/40 text-[10px] font-mono font-bold transition">
        <Calendar className="w-3 h-3" /> + ETA
      </button>
    ) : null;
  }
  return (
    <button type="button" onClick={onClick} disabled={!interactive}
      title={interactive ? 'Edit ETA' : etaLabel(value)}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ${tone.chip} ${interactive ? 'hover:ring-2 hover:ring-brand/30 cursor-pointer' : 'cursor-default'} transition`}>
      {Glyph && <Glyph className="w-3 h-3" />} {etaLabel(value)}
    </button>
  );
};

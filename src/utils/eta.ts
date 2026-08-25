export type EtaKind = 'date' | 'quarter' | 'tbd' | 'tag' | 'none';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const QUARTER_RE = /^(?:(start|begin|early|mid|mid-?point|late|end)\s+)?(q[1-4])(?:\s*['’-]?\s*(\d{2,4}))?$/i;
const TBD_RE = /^(tbd|tbc|tba|n\/?a|—|-|unknown|pending|ongoing|continuous)$/i;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Classify a raw ETA string into a kind for rendering. */
export function etaKind(raw: string): EtaKind {
  const v = raw.trim();
  if (!v) return 'none';
  if (DATE_RE.test(v)) return 'date';
  if (TBD_RE.test(v)) return 'tbd';
  if (QUARTER_RE.test(v)) return 'quarter';
  return 'tag';
}

function phaseTitle(p?: string): string {
  if (!p) return '';
  const low = p.toLowerCase().replace(/[-’']/g, '');
  if (low.startsWith('mid')) return 'Mid';
  if (low.startsWith('late') || low.startsWith('end')) return 'Late';
  if (low.startsWith('early') || low.startsWith('start') || low.startsWith('begin')) return 'Early';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/** Human label for an ETA string (pretty-prints dates & normalises quarters). */
export function etaLabel(raw: string): string {
  const v = raw.trim();
  const k = etaKind(v);
  if (k === 'none') return '';
  if (k === 'date') {
    const [y, m, d] = v.split('-').map(Number);
    return `${d} ${MONTHS[(m || 1) - 1]} ${y}`;
  }
  if (k === 'quarter') {
    const match = v.match(QUARTER_RE);
    if (match) {
      const phase = phaseTitle(match[1]);
      const q = match[2].toUpperCase();
      const yr = match[3] ? (match[3].length === 2 ? `'${match[3]}` : ` ${match[3]}`) : '';
      return [phase, q + yr].filter(Boolean).join(' ');
    }
  }
  if (k === 'tbd') return v.toUpperCase();
  return v;
}

/** Semantic tone classes (text + dot + chip) per kind, on the Ingram palette. */
export function etaTone(kind: EtaKind) {
  switch (kind) {
    case 'date':
      return { dot: 'bg-brand', text: 'text-brand-deep', chip: 'bg-brand-soft text-brand-deep border-brand/30', glyph: 'cal' as const };
    case 'quarter':
      return { dot: 'bg-tech', text: 'text-tech', chip: 'bg-tech-soft text-tech border-tech/30', glyph: 'quarter' as const };
    case 'tbd':
      return { dot: 'bg-xv', text: 'text-xv-deep', chip: 'bg-xv-soft text-xv-deep border-xv/40', glyph: 'flag' as const };
    case 'tag':
      return { dot: 'bg-warn', text: 'text-warn-deep', chip: 'bg-warn-soft text-warn-deep border-warn/30', glyph: 'tag' as const };
    default:
      return { dot: 'bg-line', text: 'text-ink-soft', chip: 'bg-mist text-ink-soft border-line', glyph: 'none' as const };
  }
}

/** Sniff an initial editor mode from a stored value. */
export function sniffMode(raw: string): 'none' | 'date' | 'quarter' | 'free' {
  const k = etaKind(raw);
  if (k === 'none') return 'none';
  if (k === 'date') return 'date';
  if (k === 'quarter') return 'quarter';
  return 'free';
}

/** Parse a quarter string into { phase, q, year } for the quarter-mode selects. */
export function parseQuarter(raw: string): { phase: string; q: string; year: string } {
  const m = raw.trim().match(QUARTER_RE);
  if (!m) return { phase: '', q: '', year: '' };
  const phase = phaseTitle(m[1]).toLowerCase();
  const q = (m[2] || '').toUpperCase();
  let year = m[3] || '';
  if (year.length === 2) year = '20' + year;
  return { phase, q, year };
}

/** Compose a quarter string from the selects (omit empty parts). */
export function composeQuarter(phase: string, q: string, year: string): string {
  const parts: string[] = [];
  if (phase) parts.push(phase.charAt(0).toUpperCase() + phase.slice(1));
  if (q) parts.push(q.toUpperCase() + (year ? ` ${year}` : ''));
  return parts.join(' ');
}

export const QUICK_ETAS = ['TBD', 'Q3 2026', 'Q4 2026', 'Mid Q3', 'End Q3', 'Mid Q4'];
export const PHASES = ['', 'early', 'mid', 'late'] as const;
export const QUARTERS = ['', 'Q1', 'Q2', 'Q3', 'Q4'] as const;

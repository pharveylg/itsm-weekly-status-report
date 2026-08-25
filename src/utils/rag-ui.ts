import { RagStatus, MetricRow, computeMetricRag, computeTrendDirection } from '../types/itsm';

/* Single source of truth for RAG presentation classes (semantic tokens). */
export const RAG_LABEL: Record<RagStatus, string> = {
  green: 'Green', yellow: 'Yellow', red: 'Red', na: 'N/A',
};

export function ragDot(rag: RagStatus): string {
  return rag === 'green' ? 'bg-ok' : rag === 'yellow' ? 'bg-warn' : rag === 'red' ? 'bg-crit' : 'bg-xv';
}
export function ragText(rag: RagStatus): string {
  return rag === 'green' ? 'text-ok-deep' : rag === 'yellow' ? 'text-warn-deep' : rag === 'red' ? 'text-crit-deep' : 'text-xv-deep';
}
export function ragChip(rag: RagStatus): string {
  return rag === 'green' ? 'bg-ok-soft text-ok-deep border-ok/50'
    : rag === 'yellow' ? 'bg-warn-soft text-warn-deep border-warn/50'
    : rag === 'red' ? 'bg-crit-soft text-crit-deep border-crit/50'
    : 'bg-xv-soft text-xv-deep border-xv/50';
}

export interface RecalcMetric extends MetricRow {
  rag: RagStatus;
  dir: 'improved' | 'degraded' | 'neutral';
  trend: string;
}

export function recalcMetric(row: MetricRow): RecalcMetric {
  const lower = row.lowerIsBetter ?? true;
  const unit = row.unitType ?? 'count';
  const rag = computeMetricRag(row.weekOfJul13, row.target, lower, unit);
  const dir = computeTrendDirection(row.weekOfJul13, row.lastWeek, lower, unit);
  const trend =
    dir === 'improved' ? `Improved · ${row.lastWeek} → ${row.weekOfJul13}`
    : dir === 'degraded' ? `Worsened · ${row.lastWeek} → ${row.weekOfJul13}`
    : `Stable · ${row.lastWeek} → ${row.weekOfJul13}`;
  return { ...row, rag, dir, trend };
}

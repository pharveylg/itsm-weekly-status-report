export type PillarType = 'People' | 'Process' | 'Technology';
export type RagStatus = 'green' | 'yellow' | 'red' | 'na';
export type ItemOrigin = 'seed' | 'new';
export type TeamId = 'ingram' | 'capgemini';
export type MergeStatus = 'pending' | 'accepted' | 'rejected';

export const PILLARS: PillarType[] = ['People', 'Process', 'Technology'];
export const TEAMS: { id: TeamId; label: string; short: string; color: string; dot: string; chip: string }[] = [
  { id: 'ingram', label: 'Ingram Micro', short: 'IM', color: 'text-brand-deep', dot: 'bg-brand', chip: 'bg-brand-soft text-brand-deep border-brand/30' },
  { id: 'capgemini', label: 'Capgemini', short: 'CG', color: 'text-tech', dot: 'bg-tech', chip: 'bg-tech-soft text-tech border-tech/30' },
];
export const teamMeta = (id: TeamId) => TEAMS.find(t => t.id === id) ?? TEAMS[0];

export interface FlowItem {
  id: string;
  pillar: PillarType;
  text: string;
  rag: RagStatus;
  eta: string;
  complete: boolean;
  archived: boolean;
  origin: ItemOrigin;
  /** Which team owns this item — 'ingram' or 'capgemini'. */
  team: TeamId;
}

/** A merged item in the Merge Studio: pairs items from both teams that describe
 *  the same work, shows side-by-side RAGs, and carries an accept/reject gate. */
export interface MergedItem {
  mergeId: string;
  pillar: PillarType;
  /** The reconciled text for the final report (operator-editable). */
  text: string;
  eta: string;
  complete: boolean;
  /** Source items from each team (one or both may be present). */
  ingram?: FlowItem;
  capgemini?: FlowItem;
  /** Which team(s) contributed — 'ingram' | 'capgemini' | 'shared' */
  ownership: 'ingram' | 'capgemini' | 'shared';
  /** The reconciled RAG for the final report. */
  rag: RagStatus;
  /** Accept gate: 'pending' until the operator reviews it. */
  status: MergeStatus;
}

export interface MetricRow {
  id: string;
  metric: string;
  short: string;
  target: string;
  targetNumeric?: number;
  lowerIsBetter?: boolean;
  unitType?: 'count' | 'percent' | 'minutes' | 'hours';
  mtd: string;
  rag: RagStatus;
  lastWeek: string;
  weekOfJul13: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral' | 'improved' | 'degraded';
}

export interface FlowCardFormData {
  reportWeek: string;
  submitterName: string;
  submitterEmail: string;
  items: FlowItem[];
  additionalNotes: string;
  metricsAnalysis: string;
  metricsAnalysisByHuman?: boolean;
  webhookUrl?: string;
}

export interface PowerAutomateStep {
  id: string;
  title: string;
  type: 'trigger' | 'action' | 'condition' | 'loop';
  connector: 'Teams' | 'SharePoint' | 'Outlook' | 'Dataverse' | 'PowerAutomate' | 'Control';
  description: string;
  details: string;
  inputs?: Record<string, string>;
  outputs?: string[];
  icon: string;
}

export const activeItems = (items: FlowItem[]): FlowItem[] => items.filter(i => !i.complete && !i.archived);
export const completedItems = (items: FlowItem[]): FlowItem[] => items.filter(i => i.complete && !i.archived);
export const archivedItems = (items: FlowItem[]): FlowItem[] => items.filter(i => i.archived);
export const itemsByPillar = (items: FlowItem[], p: PillarType): FlowItem[] => items.filter(i => i.pillar === p);
export const itemsByTeam = (items: FlowItem[], t: TeamId): FlowItem[] => items.filter(i => i.team === t);

export function computeOverallRag(rags: RagStatus[]): RagStatus {
  const scored = rags.filter(r => r !== 'na');
  if (scored.length === 0) return 'green';
  if (scored.includes('red')) return 'red';
  if (scored.includes('yellow')) return 'yellow';
  return 'green';
}

export function computeMetricRag(
  weekValue: string, target: string, lowerIsBetter: boolean,
  unitType: 'count' | 'percent' | 'minutes' | 'hours'
): RagStatus {
  const w = parseMetricValue(weekValue, unitType);
  const t = parseMetricValue(target, unitType);
  if (w === null || t === null) return 'na';
  if (lowerIsBetter) {
    if (w <= t * 1.1) return 'green';
    if (w <= t * 1.5) return 'yellow';
    return 'red';
  }
  if (w >= t * 0.9) return 'green';
  if (w >= t * 0.7) return 'yellow';
  return 'red';
}

export function computeTrendDirection(
  weekValue: string, lastWeekValue: string, lowerIsBetter: boolean,
  unitType: 'count' | 'percent' | 'minutes' | 'hours'
): 'improved' | 'degraded' | 'neutral' {
  const w = parseMetricValue(weekValue, unitType);
  const l = parseMetricValue(lastWeekValue, unitType);
  if (w === null || l === null) return 'neutral';
  const diff = w - l;
  if (Math.abs(diff) < 0.01) return 'neutral';
  return lowerIsBetter ? (diff < 0 ? 'improved' : 'degraded') : (diff > 0 ? 'improved' : 'degraded');
}

export function parseMetricValue(value: string, unitType: 'count' | 'percent' | 'minutes' | 'hours'): number | null {
  const s = value.trim();
  if (!s || s.toUpperCase() === 'TBD' || s.toUpperCase() === 'N/A') return null;
  switch (unitType) {
    case 'count': { const n = parseFloat(s); return isNaN(n) ? null : n; }
    case 'percent': { const n = parseFloat(s.replace('%', '').trim()); return isNaN(n) ? null : n; }
    case 'minutes': {
      const clean = s.replace(/,/g, '');
      const h = clean.match(/(\d+)\s*h/); const m = clean.match(/(\d+)\s*m/);
      if (h || m) return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
      const n = parseFloat(clean); return isNaN(n) ? null : n;
    }
    case 'hours': {
      const clean = s.replace(/,/g, '');
      const h = clean.match(/(\d+)\s*h/); const m = clean.match(/(\d+)\s*m/);
      if (h || m) return (h ? parseInt(h[1], 10) : 0) + (m ? parseInt(m[1], 10) / 60 : 0);
      const n = parseFloat(clean); return isNaN(n) ? null : n;
    }
    default: return null;
  }
}

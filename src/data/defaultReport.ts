import { FlowCardFormData, FlowItem, MetricRow, TeamId, activeItems, completedItems, computeOverallRag } from '../types/itsm';
import { recalcMetric } from '../utils/rag-ui';
import { autoConsolidatedAnalysis } from '../utils/metricAnalyst';

let _id = 0;
const it = (
  team: TeamId, pillar: FlowItem['pillar'], text: string, rag: FlowItem['rag'], eta: string,
  complete: boolean, origin: FlowItem['origin'] = 'seed'
): FlowItem => ({ id: `${team[0]}${++_id}`, pillar, text, rag, eta, complete, archived: false, origin, team });

// ── Ingram Micro items ──────────────────────────────────────────────────────
const ingramItems: FlowItem[] = [
  // Section 1 · completed
  it('ingram', 'Technology', 'Incident & Major Incident tabs added to the Executive Dashboard (Phase 1d, deployed 7/17).', 'green', '2026-07-17', true),
  it('ingram', 'Technology', 'SolarWinds version upgrade to 2026.1 — US-SAM production Jul 19; ALL instances now upgraded.', 'green', '2026-07-19', true),
  // Section 2 · active
  it('ingram', 'People', 'Identity Management: weekly persona beta sessions with HR; Copilot persona modeling on SNOW REQ + Workday + Intune; PoC by end of week.', 'green', '2026-07-18', false),
  it('ingram', 'Technology', 'ServiceNow Storage Capacity Reduction — design doc 95%; online data deletion + SNOW clean-up jobs running.', 'green', '2026-07-24', false),
  it('ingram', 'Technology', 'Service Aware CMDB Wave 1.1 — AWS & Azure tag ingestion with engineering; capture method under review.', 'green', 'Q3 2026', false),
  it('ingram', 'Technology', 'SolarWinds → Datadog migration — Orion DB snapshot requested; reconvene for POC instrumentation.', 'yellow', '2026-07-22', false),
  it('ingram', 'Technology', 'Monitoring Coverage KPI (CMDB vs SolarWinds) — remediating unmonitored prod devices; K8s tagging with Cloud + SRE.', 'yellow', 'Mid Q3', false),
  it('ingram', 'Technology', 'NICE Chat Bot — Phase 1 SOW in review; Copilot ↔ SNOW PoC stalled; SOW rewording for Cognigy + Copilot.', 'red', 'TBD', false),
  it('ingram', 'Technology', 'ServiceNow Ticket Governance — reduce Dave\'s queue; IAM/GSD stale REQ cleanup; termination queue with GC.', 'yellow', '', false),
  // Shared work items (Ingram side)
  it('ingram', 'Process', 'SLA finalization ITSM / IOC / ServiceNow — Capgemini CR still pending; RSDD document overdue (was Jul 15).', 'red', '2026-07-15', false),
  it('ingram', 'Process', 'MIM & Change Management Workday e-learning upload — full comm training plan pending Capgemini.', 'yellow', '2026-07-24', false),
  it('ingram', 'Process', 'Incident Controller Rulebook — finalizing with Capgemini, then deploy with training & comms.', 'yellow', 'Q3 2026', false),
];

// ── Capgemini items ─────────────────────────────────────────────────────────
const capgeminiItems: FlowItem[] = [
  // Section 1 · completed
  it('capgemini', 'Process', 'Problem Task approval-flow update — KB article published (Jul 16).', 'green', '2026-07-16', true),
  // Section 2 · active
  it('capgemini', 'Process', 'Request Management SLA enforcement + manager-approval-rate report across task fulfilment teams.', 'yellow', 'Mid Q3', false),
  it('capgemini', 'Process', 'Non-Major Problem Management process (P2) — 70% doc review done; meeting scheduling waiting on Ingram.', 'yellow', 'TBD', false),
  it('capgemini', 'Process', 'ServiceNow KB publication + Problem RCA analysis with the ITSM Problem team to lift the SLA.', 'green', '2026-07-31', false),
  it('capgemini', 'Process', 'Change Mgmt template revision — RUN alignment; CAB PIR for failed changes.', 'green', 'End Q3', false),
  // Shared work items (Capgemini side — mirrors some Ingram items)
  it('capgemini', 'Process', 'SLA finalization ITSM / IOC / ServiceNow — CR being raised; RSDD document in progress.', 'yellow', '2026-07-15', false),
  it('capgemini', 'Process', 'MIM & Change Management e-learning — exploring Workday implementation options with Julie.', 'yellow', '2026-07-24', false),
  it('capgemini', 'Process', 'Incident Controller Rulebook — finalizing draft and communications plan.', 'green', 'Q3 2026', false),
];

export const METRICS_DATA: MetricRow[] = [
  { id: 'mi_count', metric: 'Monthly Major Incidents', short: 'MIs', target: '8', targetNumeric: 8, lowerIsBetter: true, unitType: 'count', mtd: '4', rag: 'green', lastWeek: '2', weekOfJul13: '1', trend: 'Decreased vs last week', trendDirection: 'improved' },
  { id: 'mi_detection', metric: 'MI Detected by Alerting', short: 'Alerting', target: '90%', targetNumeric: 90, lowerIsBetter: false, unitType: 'percent', mtd: '25%', rag: 'red', lastWeek: '50%', weekOfJul13: '100%', trend: 'Jul 13 hit 100%; MTD 25% needs watch', trendDirection: 'improved' },
  { id: 'mttd', metric: 'Mean Time to Detect', short: 'MTTD', target: '15 min', targetNumeric: 15, lowerIsBetter: true, unitType: 'minutes', mtd: '28m', rag: 'red', lastWeek: '1h 32m', weekOfJul13: '8m', trend: '8m vs 15m target this week', trendDirection: 'improved' },
  { id: 'mtte', metric: 'Mean Time to Engage', short: 'MTTE', target: '30 min', targetNumeric: 30, lowerIsBetter: true, unitType: 'minutes', mtd: '21m', rag: 'green', lastWeek: '18m', weekOfJul13: '7m', trend: 'Record 7m engagement', trendDirection: 'improved' },
  { id: 'mttr', metric: 'Mean Time to Repair', short: 'MTTR', target: '1h 25m', targetNumeric: 1.42, lowerIsBetter: true, unitType: 'hours', mtd: '11h 2m', rag: 'red', lastWeek: '1h 44m', weekOfJul13: '21h 14m', trend: 'Deep DB-lock troubleshooting', trendDirection: 'degraded' },
  { id: 'mi_impact', metric: 'MI Business Impact', short: 'Impact', target: 'TBD', targetNumeric: undefined, lowerIsBetter: true, unitType: 'hours', mtd: '10h 47m', rag: 'na', lastWeek: '1h 44m', weekOfJul13: '21h 14m', trend: 'Correlates with MTTR', trendDirection: 'neutral' },
];

const seedRecalc = METRICS_DATA.map(recalcMetric);
const allSeedItems = [...ingramItems, ...capgeminiItems];
const seedOverall = computeOverallRag([...activeItems(allSeedItems).map(i => i.rag), ...seedRecalc.map(m => m.rag)]);
const seedAnalysis = autoConsolidatedAnalysis(seedRecalc, {
  overall: seedOverall,
  activeCount: activeItems(allSeedItems).length,
  completedCount: completedItems(allSeedItems).length,
});

const makeFormData = (team: string, items: FlowItem[]): FlowCardFormData => ({
  reportWeek: 'Week of Jul 13, 2026',
  submitterName: team === 'ingram' ? 'ITSM Operations Lead (Ingram Micro)' : 'Service Delivery Lead (Capgemini)',
  submitterEmail: team === 'ingram' ? 'patrickharvey.gaddi@ingrammicro.com' : 'capgemini-sdl@ingrammicro.com',
  items,
  additionalNotes: '',
  metricsAnalysis: seedAnalysis,
  metricsAnalysisByHuman: false,
});

export const INITIAL_INGRAM_DATA: FlowCardFormData = makeFormData('ingram', ingramItems);
export const INITIAL_CAPGEMINI_DATA: FlowCardFormData = makeFormData('capgemini', capgeminiItems);

// Legacy single-form compat (for tabs that haven't been split yet)
export const INITIAL_FLOWCARD_DATA: FlowCardFormData = makeFormData('ingram', allSeedItems);

import { RagStatus, parseMetricValue } from '../types/itsm';

interface M {
  id: string; short: string; metric: string; target: string; mtd: string;
  lastWeek: string; weekOfJul13: string; rag: RagStatus;
  dir: 'improved' | 'degraded' | 'neutral';
  lowerIsBetter?: boolean; unitType?: 'count' | 'percent' | 'minutes' | 'hours';
}

interface Ctx { overall: RagStatus; activeCount: number; completedCount: number; }

const word = (o: RagStatus) => (o === 'green' ? 'green' : o === 'yellow' ? 'amber' : 'red');

function lowerPhrase(r: number) {
  if (r >= 8) return 'collapsed';
  if (r >= 4) return 'cut sharply';
  if (r >= 2) return 'cut roughly in half';
  if (r >= 1.3) return 'eased down';
  return 'nudged down';
}
function higherPhrase(r: number) {
  if (r >= 4) return 'more than quadrupled';
  if (r >= 2) return 'roughly doubled';
  if (r >= 1.4) return 'climbed';
  if (r >= 1.1) return 'ticked up';
  return 'held';
}

/**
 * One consolidated, data-driven read across every KPI — the studio's
 * "AI-assisted" draft in an offline build. It reads the live numbers and writes
 * a single exec-summary paragraph the operator then owns and edits, committing
 * it with Done. Falls back to a plain invite when there's nothing to score.
 */
export function autoConsolidatedAnalysis(metrics: M[], ctx: Ctx): string {
  if (!metrics.length) {
    return 'No KPIs entered yet — type this week’s values in the table above and this summary writes itself; until then, drop the headline in by hand.';
  }

  const rows = metrics.map(m => {
    const u = m.unitType ?? 'count';
    return {
      m, u,
      w: parseMetricValue(m.weekOfJul13, u),
      l: parseMetricValue(m.lastWeek, u),
      t: parseMetricValue(m.target, u),
      md: parseMetricValue(m.mtd, u),
      lower: m.lowerIsBetter ?? true,
    };
  });

  // brightest win: improved + green, by magnitude of move
  const winCands = rows.filter(r => r.m.dir === 'improved' && r.w != null && r.l != null && r.l > 0 && r.w > 0)
    .map(r => ({ r, mag: r.lower ? r.l! / r.w! : r.w! / r.l! }))
    .filter(x => x.mag > 1.05)
    .sort((a, b) => b.mag - a.mag);
  const win = winCands.find(x => x.r.m.rag === 'green') ?? winCands[0];
  const improvedAny = !win ? rows.find(r => r.m.dir === 'improved' && r.w != null && r.l != null) : null;

  // heaviest drag: reds then yellows, by distance from target
  const dragCands = rows.filter(r => r.m.rag !== 'green' && r.w != null && r.t != null && r.t > 0)
    .map(r => ({ r, sev: r.lower ? r.w! / r.t! : r.t! / r.w! }))
    .sort((a, b) => (b.r.m.rag === 'red' ? 1 : 0) - (a.r.m.rag === 'red' ? 1 : 0) || b.sev - a.sev);
  const drag = dragCands[0];
  const criticals = rows.filter(r => r.m.rag === 'red').length;

  const alertDiv = rows.find(r => r.m.id === 'mi_detection' && r.w != null && r.t != null && r.w >= r.t * 0.9 && r.md != null && r.md < r.t * 0.7);
  const yellowDeg = !drag ? rows.find(r => r.m.rag === 'yellow' && r.m.dir === 'degraded') : null;

  const o = word(ctx.overall);
  const S: string[] = [];

  // headline
  if (ctx.overall === 'green') {
    S.push(`Every metric that can be scored sits inside target this week — the operation is running clean, and the ${o} headline reflects it.`);
  } else if (ctx.overall === 'yellow') {
    S.push(`The board reads ${o}: most lines are within reach, but a couple are asking for attention before they harden into reds.`);
  } else if (drag) {
    S.push(`The board is ${o} this week, and ${drag.r.m.short} is doing most of the damage — this is a triage week, not a tuning week.`);
  } else {
    S.push(`The board is ${o} this week, with ${criticals} metric${criticals === 1 ? '' : 's'} outside tolerance — this is a triage week, not a tuning week.`);
  }

  // win / momentum
  if (win) {
    const r = win.mag;
    const ph = win.r.lower ? lowerPhrase(r) : higherPhrase(r);
    S.push(`${win.r.m.short} is the bright spot — ${ph} to ${win.r.m.weekOfJul13} against a ${win.r.m.target} target, the kind of reading that pays for the work upstream.`);
  } else if (improvedAny) {
    S.push(`No metric is fully green on momentum, but ${improvedAny.m.short} at least bent the right way — ${improvedAny.m.weekOfJul13} this week versus ${improvedAny.m.lastWeek} last — a foothold to build on.`);
  }

  // drag / soft spot
  if (drag) {
    let cons: string;
    if (drag.r.m.id === 'mttr') cons = ' Repair time like that turns every incident into a business-impact event, so it is the line to put a parallel war-room and a rollback runbook around this week.';
    else if (drag.r.m.id === 'mi_detection') cons = ' Coverage gaps there mean majors surface by user report rather than by alarm — tune the thresholds before the next one writes itself into the repair clock.';
    else cons = ` Left alone it pins the overall at ${o}; it needs a named owner and a date in the priorities, not another week of watch.`;
    S.push(`${drag.r.m.short} is the weight on the RAG — ${drag.r.m.weekOfJul13} against a ${drag.r.m.target} target.${cons}`);
  } else {
    const y = rows.find(r => r.m.rag === 'yellow');
    if (y) S.push(`Nothing is outright red, but ${y.m.short} sits off target and is the soft spot — a PIR now is cheaper than a red next week.`);
  }

  // divergence / drift
  if (alertDiv) {
    S.push(`Watch the shape of ${alertDiv.m.short}: the week itself landed well (${alertDiv.m.weekOfJul13}) while month-to-date (${alertDiv.m.mtd}) still trails the ${alertDiv.m.target} line — one strong reading does not close that gap on its own.`);
  } else if (yellowDeg) {
    S.push(`${yellowDeg.m.short} is drifting the wrong way and is worth a look before it tips.`);
  }

  // tie-out to the workstreams
  if (ctx.activeCount + ctx.completedCount > 0) {
    const py = ctx.activeCount === 1 ? 'y' : 'ies';
    S.push(`On the workstreams, ${ctx.activeCount} priorit${py} stay open and ${ctx.completedCount} closed this cycle — the KPI story above is what that effort is earning.`);
  }

  return S.join(' ');
}

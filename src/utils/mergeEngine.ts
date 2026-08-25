import { FlowItem, MergedItem, activeItems, completedItems } from '../types/itsm';

/**
 * Simple similarity score: Jaccard on lowercased word sets.
 * A score > 0.35 is a likely match for ITSM work items.
 */
function similarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / (wordsA.size + wordsB.size - intersection);
}

/** Choose the worse (more cautious) RAG of two items. */
function worseRag(a: FlowItem['rag'], b: FlowItem['rag']): FlowItem['rag'] {
  const order = { red: 3, yellow: 2, green: 1, na: 0 };
  return order[a] >= order[b] ? a : b;
}

/**
 * Produce the initial merged item set from two independent team datasets.
 *
 * 1. Pair items from Ingram and Capgemini that are likely the same work
 *    (similarity > 0.35 on the same pillar) — these become "shared" with
 *    both source items attached and the worse RAG as the reconciled default.
 * 2. Unpaired items become team-only entries.
 * 3. Completed items from both teams are included (marked complete).
 * 4. All items start with status = 'pending' so the operator must review.
 */
export function buildMergedItems(ingramItems: FlowItem[], capgeminiItems: FlowItem[]): MergedItem[] {
  const imActive = activeItems(ingramItems);
  const imComplete = completedItems(ingramItems);
  const cgActive = activeItems(capgeminiItems);
  const cgComplete = completedItems(capgeminiItems);

  const result: MergedItem[] = [];
  let mid = 0;
  const usedCg = new Set<string>();

  // Pass 1: pair active items by similarity within the same pillar
  for (const im of imActive) {
    let bestMatch: FlowItem | null = null;
    let bestScore = 0;
    for (const cg of cgActive) {
      if (usedCg.has(cg.id)) continue;
      if (im.pillar !== cg.pillar) continue;
      const score = similarity(im.text, cg.text);
      if (score > bestScore) { bestScore = score; bestMatch = cg; }
    }

    if (bestMatch && bestScore > 0.35) {
      usedCg.add(bestMatch.id);
      result.push({
        mergeId: `m${++mid}`,
        pillar: im.pillar,
        text: im.text, // Ingram's text as default; operator can edit
        eta: im.eta || bestMatch.eta,
        complete: false,
        ingram: im,
        capgemini: bestMatch,
        ownership: 'shared',
        rag: worseRag(im.rag, bestMatch.rag),
        status: 'pending',
      });
    } else {
      result.push({
        mergeId: `m${++mid}`,
        pillar: im.pillar,
        text: im.text,
        eta: im.eta,
        complete: false,
        ingram: im,
        ownership: 'ingram',
        rag: im.rag,
        status: 'pending',
      });
    }
  }

  // Pass 2: unpaired Capgemini active items
  for (const cg of cgActive) {
    if (usedCg.has(cg.id)) continue;
    result.push({
      mergeId: `m${++mid}`,
      pillar: cg.pillar,
      text: cg.text,
      eta: cg.eta,
      complete: false,
      capgemini: cg,
      ownership: 'capgemini',
      rag: cg.rag,
      status: 'pending',
    });
  }

  // Pass 3: completed items from both teams
  for (const im of imComplete) {
    result.push({
      mergeId: `m${++mid}`,
      pillar: im.pillar,
      text: im.text,
      eta: im.eta,
      complete: true,
      ingram: im,
      ownership: 'ingram',
      rag: im.rag,
      status: 'pending',
    });
  }
  for (const cg of cgComplete) {
    result.push({
      mergeId: `m${++mid}`,
      pillar: cg.pillar,
      text: cg.text,
      eta: cg.eta,
      complete: true,
      capgemini: cg,
      ownership: 'capgemini',
      rag: cg.rag,
      status: 'pending',
    });
  }

  return result;
}

/** Items accepted into the final report, as a flat FlowItem array for the digest. */
export function acceptedAsFlowItems(merged: MergedItem[]): FlowItem[] {
  return merged
    .filter(m => m.status === 'accepted')
    .map(m => ({
      id: m.mergeId,
      pillar: m.pillar,
      text: m.text,
      rag: m.rag,
      eta: m.eta,
      complete: m.complete,
      archived: false,
      origin: 'seed' as const,
      team: m.ownership === 'capgemini' ? 'capgemini' as const : 'ingram' as const,
    }));
}

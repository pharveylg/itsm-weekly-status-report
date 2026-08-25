import React, { useState } from 'react';
import { FlowCardFormData, RagStatus } from '../types/itsm';
import { generateAdaptiveCardJson } from '../data/powerAutomateWorkflow';
import { BrandLockup } from './BrandLockup';
import { Copy, Download, Check, Code, ShieldCheck } from 'lucide-react';

interface Props { formData: FlowCardFormData; overall: RagStatus; }

export const AdaptiveCardJsonViewer: React.FC<Props> = ({ formData, overall }) => {
  const [copied, setCopied] = useState(false);
  const cardPayload = generateAdaptiveCardJson(formData, overall);
  const jsonString = JSON.stringify(cardPayload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ITSM_Weekly_FlowCard_AdaptiveCard_v1.5.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="stripes panel-soft p-8 sm:p-10 relative overflow-hidden reveal">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand to-brand-deep" />
        <div className="relative z-10 flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line/70">
          <BrandLockup />
          <span className="text-[10px] font-mono text-ink-soft bg-white/70 border border-line rounded px-2 py-1">
            schema · adaptive-card.json v1.5
          </span>
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/80 border border-line text-[11px] font-bold font-mono text-brand-deep uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                Schema Validated
              </span>
              <span className="text-xs text-ink-soft font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ok dot-live" />
                Auto-synced with form
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight leading-tight">
              Raw Adaptive Card payload — paste into Power Automate
            </h2>
            <p className="text-sm text-ink-soft leading-relaxed max-w-xl">
              Drop this validated JSON straight into the <em className="text-ink font-semibold not-italic">“Post adaptive card and wait for a response”</em> action. Every per-pillar RAG selector and the auto overall RAG are wired into the schema.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCopy}
                className="inline-flex items-center px-3.5 py-2 text-xs font-bold rounded-lg bg-white hover:bg-mist text-ink border border-line transition active:scale-[0.98] shadow-sm font-mono"
              >
                {copied ? <Check className="w-4 h-4 mr-1.5 text-ok" /> : <Copy className="w-4 h-4 mr-1.5 text-brand" />}
                {copied ? 'Copied Card!' : 'Copy Card JSON'}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg bg-brand hover:bg-brand-deep text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition active:scale-[0.98]"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download AdaptiveCard.json
              </button>
            </div>
          </div>

          {/* Medallion */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono text-ink-soft uppercase tracking-widest">Payload</span>
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-white to-brand-soft border-2 border-brand/40 flex items-center justify-center shadow-xl shadow-brand/15">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center shadow-lg">
                <Code className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-base font-extrabold font-display text-brand-deep tracking-wide">v1.5</span>
            <span className="text-[10px] font-mono text-ink-soft lowercase">adaptive cards</span>
          </div>
        </div>
      </section>

      {/* Terminal JSON readout */}
      <div className="terminal rounded-2xl overflow-hidden font-mono shadow-2xl">
        <div className="terminal-titlebar px-5 py-2.5 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-2 text-brand-bright font-bold">
            <span className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-crit/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-warn/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-ok/80" />
            </span>
            <span className="ml-1">adaptive-card.json</span>
          </span>
          <span className="text-on-navy-soft">{jsonString.length.toLocaleString()} chars</span>
        </div>
        <pre className="p-5 text-[11px] text-[#bcd0f0] overflow-x-auto max-h-[600px] scrollbar-thin leading-relaxed">
          {jsonString}
        </pre>
      </div>
    </div>
  );
};

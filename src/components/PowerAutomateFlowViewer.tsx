import React, { useState } from 'react';
import { POWER_AUTOMATE_STEPS, generatePowerAutomateFlowDefinitionJson } from '../data/powerAutomateWorkflow';
import { BrandLockup } from './BrandLockup';
import {
  Workflow, Copy, Download, Check, ArrowDown, MessageSquare, Database, Mail,
  Send, Code, ExternalLink, Sparkles, Terminal, Zap, Clock,
} from 'lucide-react';

export const PowerAutomateFlowViewer: React.FC = () => {
  const [selectedStepId, setSelectedStepId] = useState<string>('step_2');
  const [copied, setCopied] = useState(false);
  const flowJson = generatePowerAutomateFlowDefinitionJson();

  const handleCopy = () => { navigator.clipboard.writeText(JSON.stringify(flowJson, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2500); };
  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(flowJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ITSM_Weekly_FlowCard_PowerAutomate_Flow.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const selected = POWER_AUTOMATE_STEPS.find(s => s.id === selectedStepId) || POWER_AUTOMATE_STEPS[1];

  const stepIcon = (name: string) => {
    switch (name) {
      case 'MessageSquare': return <MessageSquare className="w-5 h-5" />;
      case 'Code': return <Code className="w-5 h-5" />;
      case 'Database': return <Database className="w-5 h-5" />;
      case 'Mail': return <Mail className="w-5 h-5" />;
      case 'Send': return <Send className="w-5 h-5" />;
      case 'Zap': return <Zap className="w-5 h-5" />;
      case 'Clock': return <Clock className="w-5 h-5" />;
      default: return <Workflow className="w-5 h-5" />;
    }
  };
  const stepIconColor = (name: string, active: boolean) => {
    if (active) return 'text-brand-bright';
    switch (name) {
      case 'Code': return 'text-xv-slate';
      case 'Database': return 'text-tech';
      case 'Mail': return 'text-warn';
      case 'Send': return 'text-ok';
      case 'Clock': case 'Zap': return 'text-brand-bright';
      default: return 'text-brand';
    }
  };
  const connectorTint = (c: string) =>
    c === 'Teams' ? 'bg-brand-soft text-brand-deep border-brand/30'
    : c === 'SharePoint' ? 'bg-tech-soft text-tech border-tech/30'
    : c === 'Outlook' ? 'bg-warn-soft text-warn-deep border-warn/30'
    : c === 'Control' ? 'bg-xv-soft text-xv-deep border-xv/30'
    : 'bg-mist text-ink-soft border-line';

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="stripes panel-soft p-8 sm:p-10 relative overflow-hidden reveal">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand to-brand-deep" />
        <div className="relative z-10 flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line/70">
          <BrandLockup />
          <span className="text-[10px] font-mono text-ink-soft bg-white/70 border border-line rounded px-2 py-1">logic apps · schema 2016-06-01</span>
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/80 border border-line text-[11px] font-bold font-mono text-brand-deep uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-brand" /> Cloud Flow Package
              </span>
              <span className="text-xs text-ink-soft font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ok dot-live" /> 6 stages · import-ready
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight leading-tight">
              The full Power Automate workflow — export & import in one click
            </h2>
            <p className="text-sm text-ink-soft leading-relaxed max-w-xl">
              Delivers the Adaptive Card to Teams, parses every People / Process / Technology field plus its RAG, auto-composes the overall status, writes to SharePoint, and emails the executive digest.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleCopy} className="inline-flex items-center px-3.5 py-2 text-xs font-bold rounded-lg bg-white hover:bg-mist text-ink border border-line transition font-mono active:scale-[0.98] shadow-sm">
                {copied ? <Check className="w-4 h-4 mr-1.5 text-ok" /> : <Copy className="w-4 h-4 mr-1.5 text-brand" />}{copied ? 'Copied JSON!' : 'Copy Flow JSON'}
              </button>
              <button onClick={handleDownload} className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg bg-brand hover:bg-brand-deep text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition active:scale-[0.98]">
                <Download className="w-4 h-4 mr-1.5" /> Download Flow (.json)
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-mono text-ink-soft uppercase tracking-widest">Stages</span>
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-white to-brand-soft border-2 border-brand/40 flex items-center justify-center shadow-xl shadow-brand/15">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center shadow-lg">
                <Workflow className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-base font-extrabold font-display text-brand-deep tracking-wide">06</span>
            <span className="text-[10px] font-mono text-ink-soft lowercase">connected actions</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Diagram */}
        <div className="lg:col-span-7 panel p-6 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-2 font-display">
              <Workflow className="w-4 h-4 text-brand" /> Interactive workflow diagram
            </h3>
            <span className="text-[11px] text-ink-soft font-mono">click a stage to inspect</span>
          </div>
          <div className="space-y-2 pt-1">
            {POWER_AUTOMATE_STEPS.map((step, idx) => {
              const active = selectedStepId === step.id;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => setSelectedStepId(step.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all hover:-translate-y-0.5 shadow-sm ${
                      active ? 'bg-brand-soft border-brand ring-2 ring-brand/30' : 'bg-mist/70 border-line hover:border-brand/40 hover:shadow-md'
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${active ? 'bg-navy' : 'bg-white border border-line'}`}>
                        <span className={stepIconColor(step.icon, active)}>{stepIcon(step.icon)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-xs font-display text-ink">{step.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${connectorTint(step.connector)}`}>{step.connector}</span>
                        </div>
                        <p className="text-xs text-ink-soft mt-1 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  </button>
                  {idx < POWER_AUTOMATE_STEPS.length - 1 && (
                    <div className="flex justify-center text-brand"><ArrowDown className="w-4 h-4 animate-bounce" /></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Inspector + guide */}
        <div className="lg:col-span-5 space-y-4">
          <div className="terminal rounded-2xl overflow-hidden shadow-xl">
            <div className="terminal-titlebar px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-bright font-bold text-[11px] font-mono uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Step Inspector
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-soft text-on-navy border border-navy-line">{selected.connector}</span>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <span className="text-on-navy-soft block text-[11px] font-mono">ACTION</span>
                <strong className="text-on-navy font-display">{selected.title}</strong>
              </div>
              <div>
                <span className="text-on-navy-soft block text-[11px] font-mono">PURPOSE</span>
                <p className="text-on-navy leading-relaxed bg-navy-deep/60 p-2.5 rounded-lg border border-navy-line text-xs mt-1">{selected.details}</p>
              </div>
              {selected.inputs && (
                <div>
                  <span className="text-brand-bright block text-[11px] font-mono font-semibold">PARAMETERS</span>
                  <div className="bg-navy-deep/60 p-3 rounded-lg border border-navy-line space-y-1.5 text-[11px] mt-1 font-mono">
                    {Object.entries(selected.inputs).map(([k, v]) => (
                      <div key={k} className="flex flex-col border-b border-navy-line pb-1 last:border-0 last:pb-0">
                        <span className="text-warn text-[10px]">{k}</span>
                        <span className="text-on-navy break-words">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel p-5 space-y-3">
            <div className="flex items-center gap-1.5 pb-2 border-b border-line">
              <Terminal className="w-4 h-4 text-brand" />
              <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider font-display">Import into Power Automate</h4>
            </div>
            <ol className="space-y-2 text-xs text-ink list-decimal list-inside leading-relaxed">
              <li>Click <strong>Download Flow (.json)</strong> to save the definition.</li>
              <li>Open <a href="https://make.powerautomate.com" target="_blank" rel="noreferrer" className="text-brand-deep font-bold hover:underline inline-flex items-center gap-0.5 font-mono">make.powerautomate.com <ExternalLink className="w-3 h-3" /></a>.</li>
              <li><strong>My flows → Import → Import package (.json)</strong>.</li>
              <li>Connect <span className="font-mono text-brand-deep">Teams</span>, <span className="font-mono text-tech">SharePoint</span>, <span className="font-mono text-warn-deep">Outlook</span>.</li>
              <li><strong>Save & turn on</strong> — the weekly recurrence is live.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

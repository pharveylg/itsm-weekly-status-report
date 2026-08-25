import React from 'react';
import {
  Workflow,
  MessageSquare,
  BarChart3,

  Layers,
  Download,
  CheckCircle2,
  RefreshCw,
  Radar,
  Eye,
  GitMerge,
  FileText,
} from 'lucide-react';
import { RagStatus } from '../types/itsm';

type TabKey = 'flowcard-ingram' | 'flowcard-capgemini' | 'team-doc' | 'merge-studio' | 'flow-builder' | 'executive-report' | 'adaptive-json' | 'm365-connections' | 'deliverables';

interface HeaderProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  onDownloadFlowJson: () => void;
  onResetToReportData: () => void;
  overallRag: RagStatus;
}

const TABS: { key: TabKey; label: string; tag: string; Icon: React.ElementType }[] = [
  { key: 'flowcard-ingram', label: 'Ingram Micro', tag: 'FlowCard', Icon: MessageSquare },
  { key: 'flowcard-capgemini', label: 'Capgemini', tag: 'FlowCard', Icon: MessageSquare },
  { key: 'team-doc', label: 'Weekly Report Doc', tag: 'Unmerged', Icon: FileText },
  { key: 'merge-studio', label: 'Merge Studio', tag: 'Reconcile', Icon: GitMerge },
  { key: 'executive-report', label: 'Executive Report', tag: 'Finalize', Icon: BarChart3 },
  { key: 'flow-builder', label: 'Power Automate', tag: 'Export', Icon: Workflow },
  { key: 'm365-connections', label: 'M365 Connections', tag: 'Setup', Icon: Layers },
  { key: 'deliverables', label: 'Sent Artifacts', tag: 'Preview', Icon: Eye },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onDownloadFlowJson,
  onResetToReportData,
  overallRag,
}) => {
  const ragLabel = overallRag === 'green' ? 'GREEN' : overallRag === 'yellow' ? 'YELLOW' : overallRag === 'red' ? 'RED' : 'N/A';
  const ragDot = overallRag === 'green' ? 'bg-ok' : overallRag === 'yellow' ? 'bg-warn' : overallRag === 'red' ? 'bg-crit' : 'bg-xv';
  const ragChip =
    overallRag === 'green' ? 'bg-ok-soft text-ok-deep border-ok/50'
    : overallRag === 'yellow' ? 'bg-warn-soft text-warn-deep border-warn/50'
    : overallRag === 'red' ? 'bg-crit-soft text-crit-deep border-crit/50'
    : 'bg-xv-soft text-xv-deep border-xv/50';

  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-line shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-20px_rgba(16,42,82,0.4)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand mark + product title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center shadow-md shadow-brand/30 ring-1 ring-brand-bright/40 shrink-0">
            <Workflow className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-ok ring-2 ring-paper dot-live" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[15px] sm:text-lg font-extrabold tracking-tight text-ink font-display whitespace-nowrap">
                ITSM FlowCard Studio
                <span className="font-medium text-ink-soft"> / Power Automate Hub</span>
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-brand-soft text-brand-deep border border-brand/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Adaptive Card v1.5
              </span>
            </div>
            <p className="text-[11px] text-ink-soft flex items-center gap-1.5 font-mono flex-wrap">
              <span className="text-brand-deep font-bold tracking-wide">INGRAM MICRO</span>
              <span className="text-line">·</span>
              <span className="tracking-wide">ITSM OPERATIONS</span>
              <span className="text-line">·</span>
              <span>Week of Jul 13, 2026</span>
              <span className="text-line">·</span>
              <span className="flex items-center gap-1 text-ok-deep">
                <span className="w-2 h-2 rounded-full bg-ok dot-live" />
                Flow Bot Online
              </span>
            </p>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono border ${ragChip}`}>
            <Radar className="w-3.5 h-3.5 opacity-80" />
            <span className="opacity-70">AUTO</span>
            <span className={`w-2 h-2 rounded-full ${ragDot}`} />
            {ragLabel}
          </div>

          <button
            onClick={onResetToReportData}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-mist text-ink border border-line transition active:scale-[0.98] shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-brand" />
            Reload Jul 13 Data
          </button>

          <button
            onClick={onDownloadFlowJson}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold rounded-lg bg-brand hover:bg-brand-deep text-white shadow-md shadow-brand/30 border border-brand-deep/40 transition active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download Flow (.json)
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto border-t border-line scrollbar-none">
        <nav className="flex gap-1 py-1.5 min-w-max">
          {TABS.map(({ key, label, tag, Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`group flex items-center px-3.5 py-2 rounded-lg text-xs font-bold transition-all font-display ${
                  active
                    ? 'bg-brand text-white shadow-md shadow-brand/25'
                    : 'text-ink hover:bg-mist'
                }`}
              >
                <Icon className={`w-4 h-4 mr-2 transition-colors ${active ? 'text-white' : 'text-ink-soft group-hover:text-brand'}`} />
                <span className="whitespace-nowrap">{label}</span>
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                  active ? 'bg-white/20 text-white' : 'bg-mist text-ink-soft group-hover:bg-brand-soft group-hover:text-brand-deep'
                }`}>
                  {tag}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

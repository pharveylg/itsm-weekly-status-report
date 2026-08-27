import React, { useState } from 'react';
import { FlowCardFormData, TeamId, TEAMS, teamMeta, PILLARS, PillarType, activeItems, completedItems, itemsByPillar } from '../types/itsm';
import { ragDot, ragChip } from '../utils/rag-ui';
import { etaKind, etaLabel, etaTone } from '../utils/eta';
import { buildTeamWeeklyDocx } from '../utils/teamDocExport';
import { OGRP_SITE, OGRP_SITE_RELATIVE, SERVICE_DELIVERY_LIBRARY } from '../data/sharepointConfig';
import { BrandLockup } from './BrandLockup';
import {
  FileText, Users, Clock, Cpu, CheckCircle2, ListChecks,
  Loader2, Check, ExternalLink, Info, Calendar, CalendarRange, Flag, Tag, UploadCloud,
} from 'lucide-react';

interface Props {
  ingramData: FlowCardFormData;
  capgeminiData: FlowCardFormData;
}

const LIBRARY = SERVICE_DELIVERY_LIBRARY;

const PILLAR_META: Record<PillarType, { Icon: React.ElementType; icon: string }> = {
  People: { Icon: Users, icon: 'text-brand' },
  Process: { Icon: Clock, icon: 'text-xv-slate' },
  Technology: { Icon: Cpu, icon: 'text-tech' },
};

const EtaChipSm: React.FC<{ eta: string }> = ({ eta }) => {
  const k = etaKind(eta);
  if (k === 'none') return <span className="text-[9px] text-ink-soft/50 font-mono">—</span>;
  const t = etaTone(k);
  const G = k === 'date' ? Calendar : k === 'quarter' ? CalendarRange : k === 'tbd' ? Flag : Tag;
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-bold ${t.chip}`}><G className="w-2.5 h-2.5" />{etaLabel(eta)}</span>;
};

export const TeamWeeklyDocReport: React.FC<Props> = ({ ingramData, capgeminiData }) => {
  const [team, setTeam] = useState<TeamId>('ingram');
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const data = team === 'ingram' ? ingramData : capgeminiData;
  const meta = teamMeta(team);
  const comp = completedItems(data.items);
  const act = activeItems(data.items);
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const fileName = `ITSM-Weekly-${meta.label.replace(/\s+/g, '')}-${data.reportWeek.replace(/[^\w]+/g, '-')}.docx`;

  const uploadToSharePoint = async () => {
    setUploading(true);
    setUploadedUrl(null);
    setErrorMsg(null);
    try {
      // 1. Build the .docx blob in memory
      const blob = await buildTeamWeeklyDocx(meta.label, data);

      // 2. Get form digest for OGRP site
      const digRes = await fetch(`${OGRP_SITE}/_api/contextinfo`, {
        method: 'POST',
        headers: { Accept: 'application/json;odata=verbose' },
        credentials: 'include',
      });
      if (!digRes.ok) throw new Error('SharePoint authentication failed (HTTP ' + digRes.status + '). Ensure you are logged into the OGRP site.');
      const digest = (await digRes.json()).d.GetContextWebInformation.FormDigestValue;

      // 3. Upload binary blob via SharePoint REST files/add
      const uploadUrl = `${OGRP_SITE}/_api/web/getfolderbyserverrelativeurl('${OGRP_SITE_RELATIVE}/${LIBRARY}')/files/add(url='${encodeURIComponent(fileName)}',overwrite=true)`;
      const upRes = await fetch(uploadUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json;odata=verbose',
          'X-RequestDigest': digest,
        },
        body: blob,
      });

      if (!upRes.ok) {
        const errJson = await upRes.json().catch(() => null);
        const detail = errJson && errJson.error ? errJson.error.message.value : 'HTTP ' + upRes.status;
        throw new Error(detail);
      }

      const fileData = (await upRes.json()).d;
      const serverRelativeUrl = fileData.ServerRelativeUrl;
      const fullUrl = `https://ingrammicro.sharepoint.com${serverRelativeUrl}`;
      setUploadedUrl(fullUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const Section: React.FC<{ title: string; icon: React.ReactNode; list: typeof act; empty: string }> = ({ title, icon, list, empty }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b-2 border-line">
        {icon}
        <h3 className="text-sm font-extrabold text-ink uppercase tracking-wide font-display">{title}</h3>
        <span className="text-[10px] font-mono text-ink-soft ml-auto">{list.length} items</span>
      </div>
      {PILLARS.map(pillar => {
        const rows = itemsByPillar(list, pillar);
        const pm = PILLAR_META[pillar];
        return (
          <div key={pillar} className="space-y-1.5">
            <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${pm.icon}`}>
              <pm.Icon className="w-3.5 h-3.5" /> {pillar}
            </div>
            {rows.length === 0 ? (
              <p className="text-[11px] text-ink-soft italic pl-1">{empty}</p>
            ) : (
              <div className="space-y-1">
                {rows.map(it => (
                  <div key={it.id} className="flex items-start gap-2 bg-mist/40 border border-line rounded-lg px-3 py-2">
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${ragDot(it.rag)}`} />
                    <p className="flex-1 text-[12px] text-ink leading-relaxed font-body">{it.text}</p>
                    <span className={`shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${ragChip(it.rag)}`}>{it.rag.toUpperCase()}</span>
                    <span className="shrink-0"><EtaChipSm eta={it.eta} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="stripes panel-soft rounded-2xl p-8 sm:p-10 relative overflow-hidden reveal">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand to-tech" />
        <div className="relative z-10 flex items-center justify-between gap-3 pb-4 mb-5 border-b border-line/70">
          <BrandLockup />
          <span className="text-[10px] font-mono text-ink-soft bg-white/70 border border-line rounded px-2 py-1">team doc · direct SharePoint upload</span>
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/80 border border-line text-[11px] font-bold font-mono text-brand-deep uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-brand" /> Weekly Report Doc
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight leading-tight">
              Post each team's report directly to SharePoint as a Word document
            </h2>
            <p className="text-sm text-ink-soft/90 leading-relaxed font-body max-w-xl">
              Generate and upload <strong className="text-ink">{meta.label}'s</strong> unmerged Word document straight into the <span className="font-mono text-tech">{LIBRARY}</span> library with one click — no manual downloading or file dragging required.
            </p>
          </div>
          {/* Team switcher */}
          <div className="flex items-center bg-white border border-line rounded-xl p-1.5 gap-1.5 shadow-sm">
            {TEAMS.map(t => {
              const on = team === t.id;
              return (
                <button key={t.id} onClick={() => setTeam(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold font-display transition ${on ? `${t.dot} text-white shadow-md` : 'text-ink-soft hover:text-ink hover:bg-mist'}`}>
                  <span className={`w-2 h-2 rounded-full ${on ? 'bg-white' : t.dot}`} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Document preview */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-[0_30px_70px_-40px_rgba(16,42,82,0.55)] border border-line overflow-hidden">
            {/* paper header */}
            <div className="px-8 sm:px-12 pt-10 pb-6 border-b-2 border-line">
              <div className="flex items-center justify-between text-[10px] font-mono text-ink-soft uppercase tracking-wider mb-6">
                <span>ITSM Weekly Status · {meta.label}</span>
                <span>{dateStr}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-display tracking-tight">ITSM Weekly Status Report</h1>
              <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${meta.chip}`}>
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} /> {meta.label.toUpperCase()}
              </div>
              <p className="text-sm text-ink-soft font-mono mt-2">{data.reportWeek}</p>
              <p className="text-xs text-ink-soft mt-3">
                Submitted by <strong className="text-ink">{data.submitterName}</strong> · <span className="font-mono">{data.submitterEmail}</span>
              </p>
            </div>

            {/* body */}
            <div className="px-8 sm:px-12 py-8 space-y-8">
              <Section title="Section 1 · Summary & Closed Tasks from Last Week" icon={<CheckCircle2 className="w-4 h-4 text-ok" />} list={comp} empty="No items this cycle." />
              <Section title="Section 2 · Priorities for This Week" icon={<ListChecks className="w-4 h-4 text-brand" />} list={act} empty="No items this cycle." />

              {data.additionalNotes?.trim() && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-line">
                    <Info className="w-4 h-4 text-tech" />
                    <h3 className="text-sm font-extrabold text-ink uppercase tracking-wide font-display">Additional Notes</h3>
                  </div>
                  <p className="text-[12px] text-ink-soft italic font-body">{data.additionalNotes}</p>
                </div>
              )}

              <div className="pt-4 border-t border-line text-[10px] text-ink-soft font-mono flex justify-between">
                <span>{comp.length} completed · {act.length} active</span>
                <span>single-team report · not yet merged</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side panel: upload + status */}
        <div className="lg:col-span-4 space-y-4">
          <div className="panel p-5 space-y-3">
            <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider flex items-center gap-2 font-display">
              <UploadCloud className="w-4 h-4 text-brand" /> Post to SharePoint (.docx)
            </h4>
            <p className="text-[11px] text-ink-soft font-body leading-relaxed">
              Compiles {meta.label}'s report into a Word document and uploads it directly to <span className="font-mono text-tech">{LIBRARY}</span>.
            </p>
            <div className="bg-paper border border-line rounded-lg p-2.5 text-[11px] font-mono text-ink-soft break-all">
              📄 {fileName}
            </div>

            <button onClick={uploadToSharePoint} disabled={uploading}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-extrabold font-display transition active:scale-[0.98] shadow-lg ${
                uploading ? 'bg-brand/70 text-white cursor-wait'
                : uploadedUrl ? 'bg-ok text-white shadow-ok/30'
                : 'bg-gradient-to-r from-brand to-brand-bright hover:from-brand-deep hover:to-brand text-white shadow-brand/40 border border-brand-deep/40'}`}>
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading to SharePoint…</>
                : uploadedUrl ? <><Check className="w-4 h-4" /> Uploaded successfully</>
                : <><UploadCloud className="w-4 h-4" /> Upload {meta.label} report to SharePoint</>}
            </button>

            {uploadedUrl && (
              <div className="bg-ok-soft border border-ok/40 rounded-xl p-3 space-y-2 animate-fade-up">
                <div className="flex items-center gap-1.5 text-ok-deep font-bold text-xs font-display">
                  <Check className="w-4 h-4" /> Document posted
                </div>
                <a href={uploadedUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono font-bold text-ok-deep hover:underline break-all">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" /> Open in SharePoint library
                </a>
              </div>
            )}

            {errorMsg && (
              <div className="bg-crit-soft border border-crit/40 rounded-xl p-3 space-y-1 animate-fade-up text-xs text-crit-deep font-body">
                <strong className="font-display">Upload failed:</strong> {errorMsg}
                <div className="text-[10px] font-mono opacity-80 pt-1">Ensure you are logged into the OGRP site in this browser session.</div>
              </div>
            )}
          </div>

          <div className="bg-warn-soft border border-warn/40 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-warn-deep font-bold text-xs font-display">
              <Info className="w-3.5 h-3.5" /> Independent of Merge Studio
            </div>
            <p className="text-[11px] text-warn-deep/80 font-body leading-relaxed">
              This report reflects <strong>only</strong> {meta.label}'s own entries — unreviewed, unreconciled. It will not match the final merged Executive Report.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

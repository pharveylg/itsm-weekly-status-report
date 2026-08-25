import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, Header, Footer, PageNumber,
} from 'docx';
import { FlowCardFormData, PillarType, PILLARS, RagStatus, activeItems, completedItems } from '../types/itsm';
import { etaLabel, etaKind } from './eta';

const RAG_HEX: Record<RagStatus, string> = { green: '1F9D5B', yellow: 'E0A020', red: 'C83A3A', na: '8E9094' };
const RAG_LABEL: Record<RagStatus, string> = { green: 'GREEN', yellow: 'YELLOW', red: 'RED', na: 'N/A' };
const BRAND_HEX = '3D6DB5';
const INK_HEX = '1A2238';
const SOFT_HEX = '5A6478';
const LINE_HEX = 'CDD6E6';

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE_HEX };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function ragDotRun(rag: RagStatus) {
  return new TextRun({ text: '●  ', color: RAG_HEX[rag], bold: true });
}

function itemRow(text: string, rag: RagStatus, eta: string) {
  const etaText = etaKind(eta) === 'none' ? '—' : etaLabel(eta);
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 72, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [ragDotRun(rag), new TextRun({ text, color: INK_HEX, size: 20 })] })],
      }),
      new TableCell({
        width: { size: 14, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: RAG_LABEL[rag], bold: true, size: 18, color: RAG_HEX[rag] })] })],
      }),
      new TableCell({
        width: { size: 14, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: etaText, size: 18, color: SOFT_HEX, italics: true })] })],
      }),
    ],
  });
}

function tableHeaderRow() {
  const shade = { type: ShadingType.CLEAR, fill: 'EEF2F9', color: 'auto' };
  return new TableRow({
    tableHeader: true,
    children: [
      new TableCell({ width: { size: 72, type: WidthType.PERCENTAGE }, borders: cellBorders, shading: shade, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: 'ITEM', bold: true, size: 16, color: SOFT_HEX })] })] }),
      new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, borders: cellBorders, shading: shade, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'RAG', bold: true, size: 16, color: SOFT_HEX })] })] }),
      new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, borders: cellBorders, shading: shade, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ETA', bold: true, size: 16, color: SOFT_HEX })] })] }),
    ],
  });
}

function pillarBlock(pillar: PillarType, list: ReturnType<typeof activeItems>) {
  const rows = list.filter(i => i.pillar === pillar);
  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: pillar.toUpperCase(), bold: true, size: 20, color: BRAND_HEX })],
    }),
  ];
  if (rows.length === 0) {
    blocks.push(new Paragraph({ children: [new TextRun({ text: 'No items this cycle.', italics: true, size: 18, color: SOFT_HEX })] }));
  } else {
    blocks.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [tableHeaderRow(), ...rows.map(i => itemRow(i.text, i.rag, i.eta))],
    }));
  }
  return blocks;
}

/** Builds a self-contained .docx Blob for one team's unmerged weekly report. */
export async function buildTeamWeeklyDocx(teamLabel: string, formData: FlowCardFormData): Promise<Blob> {
  const comp = completedItems(formData.items);
  const act = activeItems(formData.items);
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [
      {
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: 'ITSM Weekly Status · ' + teamLabel, size: 16, color: SOFT_HEX })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Unmerged · team-only report · generated ' + dateStr + ' · page ', size: 14, color: SOFT_HEX }),
                new TextRun({ children: [PageNumber.CURRENT], size: 14, color: SOFT_HEX }),
              ],
            })],
          }),
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: 'ITSM Weekly Status Report', bold: true, color: INK_HEX, size: 40 })],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: teamLabel.toUpperCase(), bold: true, color: BRAND_HEX, size: 26 })],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: formData.reportWeek, size: 22, color: SOFT_HEX })],
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({ text: 'Submitted by: ', size: 18, color: SOFT_HEX }),
              new TextRun({ text: formData.submitterName, size: 18, bold: true, color: INK_HEX }),
              new TextRun({ text: '   ·   ', size: 18, color: SOFT_HEX }),
              new TextRun({ text: formData.submitterEmail, size: 18, color: SOFT_HEX }),
            ],
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: '✅ Section 1 · Summary & Closed Tasks from Last Week', bold: true, color: INK_HEX, size: 26 })],
          }),
          ...PILLARS.flatMap(p => pillarBlock(p, comp)),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 100 },
            children: [new TextRun({ text: '📌 Section 2 · Priorities for This Week', bold: true, color: INK_HEX, size: 26 })],
          }),
          ...PILLARS.flatMap(p => pillarBlock(p, act)),

          ...(formData.additionalNotes?.trim() ? [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 100 },
              children: [new TextRun({ text: 'Additional Notes', bold: true, color: INK_HEX, size: 26 })],
            }),
            new Paragraph({ children: [new TextRun({ text: formData.additionalNotes, size: 20, color: INK_HEX, italics: true })] }),
          ] : []),

          new Paragraph({
            spacing: { before: 500 },
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE_HEX } },
            children: [new TextRun({ text: `${comp.length} completed · ${act.length} active · this is a single-team report, not yet merged with the counterpart team`, italics: true, size: 16, color: SOFT_HEX })],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

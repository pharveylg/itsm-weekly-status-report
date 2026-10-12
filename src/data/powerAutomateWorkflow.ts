import {
  FlowCardFormData, PowerAutomateStep,
  activeItems, completedItems, itemsByPillar, PILLARS, PillarType,
} from '../types/itsm';
import { DISPATCH_QUEUE_LIST, WEEKLY_UPDATES_LIST, SERVICE_DELIVERY_LIBRARY, OGRP_SITE, DEFAULT_RECIPIENT } from './sharepointConfig';

/**
 * "Flow B" — the flow the studio actually depends on. The studio itself is the
 * weekly UI (FlowCard → Merge Studio → Executive Report); on Finalize it writes
 * one plain SharePoint list item (a dispatch ticket) to ITSM_Dispatch_Queue —
 * a native list-create, so it's invisible to DLP and needs no HTTP-trigger
 * exception. This flow wakes on that new item and does everything downstream:
 * generates the weekly Word doc, writes the system-of-record row, flips the
 * Teams card to closed, and sends the executive digest.
 */
export const POWER_AUTOMATE_STEPS: PowerAutomateStep[] = [
  {
    id: 'step_1', title: '1. When an item is created · ITSM_Dispatch_Queue', type: 'trigger', connector: 'SharePoint',
    description: 'Wakes the instant the studio writes a dispatch ticket on Finalize. Plain list trigger — no HTTP endpoint, no DLP exception.',
    details: 'The ticket\'s Payload column holds the whole finalized week as JSON: items[], metrics[], snapshots, and the auto-computed overall RAG. This is the only thing Flow B is coupled to — the studio never calls Power Automate directly.',
    inputs: { Site: OGRP_SITE, List: DISPATCH_QUEUE_LIST },
    icon: 'Zap',
  },
  {
    id: 'step_2', title: '2. Parse JSON · unpack the dispatch payload', type: 'action', connector: 'Control',
    description: 'Strongly-types Title/Payload into reportWeek, overallRag, items[], metrics[], and the pre-built human-readable snapshots.',
    details: 'Feeds every downstream action. Nothing is recomputed here — the studio already did the RAG rollup and the completed/priorities snapshots before dispatch; Flow B just persists and distributes them.',
    inputs: { Content: "@triggerOutputs()?['body/Payload']", Schema: 'reportWeek, overallRag, ragStatus, majorIncidents, alertDetection, completedSnapshot, prioritiesSnapshot, itemsJson, metricsJson, metricsAnalysis' },
    icon: 'Code',
  },
  {
    id: 'step_3', title: '3. Populate Word template · weekly report', type: 'action', connector: 'PowerAutomate',
    description: 'Fills a .dotx template (Completed / Priorities / KPI table / Remarks) with this week\'s fields via Word Online (Business).',
    details: 'Requires a one-time template upload to the ITSM Service Delivery library with matching content controls (reportWeek, overallRag, completedSnapshot, prioritiesSnapshot, metricsAnalysis). Standard connector — no premium license needed.',
    inputs: { Location: SERVICE_DELIVERY_LIBRARY, TemplateFile: 'ITSM_Weekly_Report_Template.dotx (upload once, then paste its file ID here)' },
    icon: 'MessageSquare',
  },
  {
    id: 'step_4', title: '4. Create file · ITSM Service Delivery', type: 'action', connector: 'SharePoint',
    description: 'Saves the populated document as this week\'s report; the filename carries the week label so re-runs never collide.',
    details: 'Output is the file\'s server-relative path/ID, captured for the Report_Doc_Url column on the next step and for the Teams/Outlook deep-links.',
    inputs: { Library: SERVICE_DELIVERY_LIBRARY, 'File name': "ITSM-Weekly-@{body('Parse_JSON')?['reportWeek']}.docx" },
    outputs: ['Report_Doc_Url'],
    icon: 'Database',
  },
  {
    id: 'step_5', title: '5. Create item · ITSM_Weekly_Updates', type: 'action', connector: 'SharePoint',
    description: 'Writes the system-of-record row: Items_JSON, Metrics_JSON, snapshots, auto RAG, window-closed timestamp, and a link to the doc.',
    details: 'One row per week. Items_JSON is the round-trippable source the studio reads back next Monday to seed the FlowCard\'s carry-forward.',
    inputs: {
      List: WEEKLY_UPDATES_LIST,
      Title: "@{body('Parse_JSON')?['reportWeek']}",
      Items_JSON: "@{body('Parse_JSON')?['itemsJson']}",
      Metrics_JSON: "@{body('Parse_JSON')?['metricsJson']}",
      Metrics_Analysis: "@{body('Parse_JSON')?['metricsAnalysis']}",
      Completed_Snapshot: "@{body('Parse_JSON')?['completedSnapshot']}",
      Priorities_Snapshot: "@{body('Parse_JSON')?['prioritiesSnapshot']}",
      RAG_Status: "@{body('Parse_JSON')?['ragStatus']}",
      Major_Incidents: "@{body('Parse_JSON')?['majorIncidents']}",
      Alert_Detection: "@{body('Parse_JSON')?['alertDetection']}",
      Window_Closed_At: '@{utcNow()}',
      Report_Doc_Url: "@{outputs('Create_file_in_Service_Delivery')?['body/Path']}",
    },
    icon: 'Database',
  },
  {
    id: 'step_6', title: '6. Compose · the closed-card JSON', type: 'action', connector: 'Control',
    description: 'Builds a small read-only Adaptive Card — RAG, completed/active counts, and a link to this week\'s doc.',
    details: 'This is what actually gets posted next. Static-ish structure filled with this week\'s values via inline expressions — no user input, no Action.Submit; it just replaces the editable card the studio itself doesn\'t use anyway.',
    inputs: { Content: 'AdaptiveCard body: reportWeek, ragStatus, completedCount, activeCount + an "Open this week\'s report" link' },
    icon: 'Code',
  },
  {
    id: 'step_7', title: '7. Post “Closed for submission” card', type: 'action', connector: 'Teams',
    description: 'Posts the composed card, read-only, with a link to the new SharePoint row and doc.',
    details: 'Shows “reopens Mon 08:00”. The studio never posts an editable Teams card at all — that was a leftover from the design this flow replaced.',
    inputs: { 'Post in': 'Channel: ITSM Weekly Updates', Card: "@outputs('Compose_Closed_Card')" },
    icon: 'Send',
  },
  {
    id: 'step_8', title: '8. Outlook · executive digest', type: 'action', connector: 'Outlook',
    description: 'HTML digest: completed wins, live priorities w/ RAG, KPI table, auto overall, deep-link to the SharePoint row.',
    details: 'To: comes from the studio\'s "Send-to" field (travels in the dispatch payload) — whatever you set on the M365 Connections tab is where this actually goes. Falls back to the test address below only if that was ever empty. Keep it on one test mailbox until this has passed repeated tests.',
    inputs: { To: `@{coalesce(recipient, '${DEFAULT_RECIPIENT}')}`, Subject: '📊 ITSM Weekly Status – @{reportWeek} | RAG @{ragStatus}' },
    icon: 'Mail',
  },
];

/* ── Adaptive Card v1.5 generator (item model) ─────────────────────────── */
function ragChoices(id: string, value: string) {
  return {
    type: 'Input.ChoiceSet', id, value, label: 'RAG',
    choices: [
      { title: '🟢 Green', value: 'green' },
      { title: '🟡 Yellow', value: 'yellow' },
      { title: '🔴 Red', value: 'red' },
    ],
  };
}

function pillarBlock(title: string, pillar: PillarType, items: ReturnType<typeof activeItems>, mode: 'completed' | 'active') {
  const rows = itemsByPillar(items, pillar);
  const block: unknown[] = [
    { type: 'TextBlock', text: `${title} · ${pillar}`, weight: 'Bolder', spacing: 'Medium' },
  ];
  if (rows.length === 0) {
    block.push({ type: 'TextBlock', text: mode === 'completed' ? '— no closed items yet this pillar —' : '— no active priorities —', isSubtle: true, size: 'Small' });
  }
  rows.forEach((it) => {
    if (mode === 'completed') {
      block.push({
        type: 'ColumnSet', columns: [
          { type: 'Column', width: 'stretch', items: [{ type: 'TextBlock', text: it.text, wrap: true }] },
          { type: 'Column', width: 'auto', items: [{ type: 'Input.Toggle', id: `archive_${it.id}`, title: 'Archive', value: 'false' }] },
        ],
      });
    } else {
      block.push({
        type: 'ColumnSet', columns: [
          { type: 'Column', width: 'stretch', items: [
            { type: 'Input.Text', id: `text_${it.id}`, isMultiline: true, value: it.text },
            { type: 'Input.Toggle', id: `complete_${it.id}`, title: 'Mark complete → bump to Section 1', value: 'false', spacing: 'Small' },
          ] },
          { type: 'Column', width: 'auto', verticalContentAlignment: 'Top', items: [ragChoices(`rag_${it.id}`, it.rag)] },
        ],
      });
    }
  });
  if (mode === 'active') {
    block.push({ type: 'TextBlock', text: `＋ New ${pillar} priority (optional)`, size: 'Small', spacing: 'Small' });
    block.push({
      type: 'ColumnSet', columns: [
        { type: 'Column', width: 'stretch', items: [{ type: 'Input.Text', id: `new_${pillar}_text`, isMultiline: true, placeholder: 'Add a net-new priority…' }] },
        { type: 'Column', width: 'auto', verticalContentAlignment: 'Top', items: [ragChoices(`new_${pillar}_rag`, 'green')] },
      ],
    });
  }
  return { type: 'Container', style: 'default', separator: true, items: block };
}

export function generateAdaptiveCardJson(formData: FlowCardFormData, overall: string): object {
  const completed = completedItems(formData.items);
  const active = activeItems(formData.items);
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.5',
    msTeams: { width: 'Full' },
    body: [
      {
        type: 'Container', style: 'emphasis', bleed: true, items: [{
          type: 'ColumnSet', columns: [
            { type: 'Column', width: 'stretch', items: [
              { type: 'TextBlock', text: 'ITSM Weekly Status FlowCard', weight: 'Bolder', size: 'Large', color: 'Accent' },
              { type: 'TextBlock', text: `Ingram Micro · ${formData.reportWeek} · window closes Mon 07:00`, isSubtle: true, spacing: 'None' },
            ] },
            { type: 'Column', width: 'auto', items: [{
              type: 'Container', style: overall === 'green' ? 'good' : overall === 'red' ? 'attention' : 'warning',
              items: [{ type: 'TextBlock', text: `RAG ${overall.toUpperCase()} (auto)`, weight: 'Bolder' }],
            }] },
          ],
        }],
      },
      { type: 'TextBlock', text: 'Mark items complete to bump them to Section 1; archive closed items to retire them. Add new priorities below. Card locks Mon 07:00.', wrap: true, isSubtle: true },
      { type: 'Container', style: 'default', separator: true, items: [
        { type: 'TextBlock', text: '✅ SECTION 1 · Completed (archive to retire)', weight: 'Bolder', color: 'Good' },
        ...PILLARS.flatMap(p => [pillarBlock('1', p, completed, 'completed')]).flatMap(c => (c as { items: unknown[] }).items),
      ] },
      { type: 'Container', style: 'default', separator: true, items: [
        { type: 'TextBlock', text: '📌 SECTION 2 · Current priorities (toggle complete / add new)', weight: 'Bolder', color: 'Accent' },
        ...PILLARS.flatMap(p => [pillarBlock('2', p, active, 'active')]).flatMap(c => (c as { items: unknown[] }).items),
      ] },
    ],
    actions: [{ type: 'Action.Submit', title: '🚀 Submit ITSM Weekly Status', style: 'positive', data: { action: 'submit', reportWeek: formData.reportWeek } }],
  };
}

/* ── Cloud Flow definition (Logic Apps schema) — Flow B ────────────────────
 * Triggers on ITSM_Dispatch_Queue, not on a recurrence — the studio itself
 * owns the weekly UI and the RAG rollup; this flow only persists + distributes
 * what Finalize already computed. Import this at make.powerautomate.com,
 * connect SharePoint/Teams/Outlook, then paste the uploaded template's file ID
 * into Populate_Word_Template before turning it on. */
export function generatePowerAutomateFlowDefinitionJson(): object {
  return {
    $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
    contentVersion: '3.0.0.0',
    parameters: {
      $connections: { defaultValue: {}, type: 'Object' },
      SharePointSiteUrl: { defaultValue: OGRP_SITE, type: 'String' },
      TeamsChannelId: { defaultValue: '19:itsm-weekly-updates-channel@thread.tacv2', type: 'String' },
      WordTemplateFileId: { defaultValue: 'PASTE_TEMPLATE_FILE_ID_AFTER_UPLOAD', type: 'String' },
    },
    triggers: {
      When_a_dispatch_ticket_is_created: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_sharepointonline', operationId: 'GetOnNewItems', apiId: '/providers/Microsoft.PowerApps/apis/shared_sharepointonline' },
          parameters: { dataset: "@parameters('SharePointSiteUrl')", table: DISPATCH_QUEUE_LIST },
        },
      },
    },
    actions: {
      Parse_JSON: {
        type: 'ParseJson',
        inputs: {
          content: "@triggerOutputs()?['body/Payload']",
          schema: {
            type: 'object',
            properties: {
              reportWeek: { type: 'string' }, recipient: { type: 'string' }, overallRag: { type: 'string' }, ragStatus: { type: 'string' },
              majorIncidents: { type: 'number' }, alertDetection: { type: 'number' },
              completedCount: { type: 'number' }, activeCount: { type: 'number' },
              completedSnapshot: { type: 'string' }, prioritiesSnapshot: { type: 'string' },
              metricsAnalysis: { type: 'string' }, itemsJson: { type: 'string' }, metricsJson: { type: 'string' },
            },
          },
        },
        runAfter: {},
      },
      Populate_Word_Template: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_wordonlinebusiness', operationId: 'PopulateWordTemplate', apiId: '/providers/Microsoft.PowerApps/apis/shared_wordonlinebusiness' },
          parameters: {
            source: 'SharePoint', dataset: "@parameters('SharePointSiteUrl')", table: SERVICE_DELIVERY_LIBRARY,
            id: "@parameters('WordTemplateFileId')",
            templateParameters: {
              reportWeek: "@{body('Parse_JSON')?['reportWeek']}", overallRag: "@{body('Parse_JSON')?['ragStatus']}",
              completedSnapshot: "@{body('Parse_JSON')?['completedSnapshot']}", prioritiesSnapshot: "@{body('Parse_JSON')?['prioritiesSnapshot']}",
              metricsAnalysis: "@{body('Parse_JSON')?['metricsAnalysis']}",
            },
          },
        },
        runAfter: { Parse_JSON: ['Succeeded'] },
      },
      Create_file_in_Service_Delivery: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_sharepointonline', operationId: 'CreateFile', apiId: '/providers/Microsoft.PowerApps/apis/shared_sharepointonline' },
          parameters: {
            dataset: "@parameters('SharePointSiteUrl')", folderPath: `/${SERVICE_DELIVERY_LIBRARY}`,
            name: "ITSM-Weekly-@{body('Parse_JSON')?['reportWeek']}.docx",
            body: "@body('Populate_Word_Template')",
          },
        },
        runAfter: { Populate_Word_Template: ['Succeeded'] },
      },
      Create_SharePoint_Weekly_Item: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_sharepointonline', operationId: 'PostItem', apiId: '/providers/Microsoft.PowerApps/apis/shared_sharepointonline' },
          parameters: {
            dataset: "@parameters('SharePointSiteUrl')", table: WEEKLY_UPDATES_LIST,
            "item/Title": "@{body('Parse_JSON')?['reportWeek']}",
            "item/Items_JSON": "@{body('Parse_JSON')?['itemsJson']}",
            "item/Metrics_JSON": "@{body('Parse_JSON')?['metricsJson']}",
            "item/Metrics_Analysis": "@{body('Parse_JSON')?['metricsAnalysis']}",
            "item/Completed_Snapshot": "@{body('Parse_JSON')?['completedSnapshot']}",
            "item/Priorities_Snapshot": "@{body('Parse_JSON')?['prioritiesSnapshot']}",
            "item/RAG_Status": "@{body('Parse_JSON')?['ragStatus']}",
            "item/Major_Incidents": "@{body('Parse_JSON')?['majorIncidents']}",
            "item/Alert_Detection": "@{body('Parse_JSON')?['alertDetection']}",
            "item/Window_Closed_At": '@{utcNow()}',
            "item/Report_Doc_Url": "@{outputs('Create_file_in_Service_Delivery')?['body/Path']}",
          },
        },
        runAfter: { Create_file_in_Service_Delivery: ['Succeeded'] },
      },
      Compose_Closed_Card: {
        type: 'Compose',
        inputs: {
          type: 'AdaptiveCard', $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', version: '1.5',
          body: [
            { type: 'TextBlock', text: "ITSM Weekly Status — @{body('Parse_JSON')?['reportWeek']}", weight: 'Bolder', size: 'Large' },
            { type: 'TextBlock', text: "RAG @{toUpper(body('Parse_JSON')?['ragStatus'])} · window closed", weight: 'Bolder' },
            { type: 'TextBlock', text: "✅ Completed: @{body('Parse_JSON')?['completedCount']}   📌 Active: @{body('Parse_JSON')?['activeCount']}", wrap: true },
            { type: 'TextBlock', text: 'Reopens Monday 08:00.', isSubtle: true, wrap: true },
          ],
          actions: [{ type: 'Action.OpenUrl', title: "Open this week's report", url: "@{outputs('Create_file_in_Service_Delivery')?['body/Path']}" }],
        },
        runAfter: { Create_SharePoint_Weekly_Item: ['Succeeded'] },
      },
      Post_Closed_For_Submission_Card: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_teams', operationId: 'PostCardInChannel', apiId: '/providers/Microsoft.PowerApps/apis/shared_teams' },
          parameters: { poster: 'Flow bot', 'body/recipient/groupId': "@parameters('TeamsChannelId')", 'body/card': "@outputs('Compose_Closed_Card')" },
        },
        runAfter: { Compose_Closed_Card: ['Succeeded'] },
      },
      Send_Executive_Digest: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_office365', operationId: 'SendEmailV2', apiId: '/providers/Microsoft.PowerApps/apis/shared_office365' },
          parameters: {
            // The studio's recipient field is authoritative — it travels in the
            // dispatch payload. This only falls back to DEFAULT_RECIPIENT if the
            // field was ever somehow empty when Finalize ran.
            "emailMessage/To": `@{coalesce(body('Parse_JSON')?['recipient'], '${DEFAULT_RECIPIENT}')}`,
            "emailMessage/Subject": "📊 ITSM Weekly Status – @{body('Parse_JSON')?['reportWeek']} | RAG @{toUpper(body('Parse_JSON')?['ragStatus'])}",
            "emailMessage/Body": '<p>Weekly ITSM status finalized. KPI snapshot, remarks, completed wins and live priorities are appended below; the full item array + the generated Word doc are archived to SharePoint.</p>',
          },
        },
        runAfter: { Post_Closed_For_Submission_Card: ['Succeeded'] },
      },
    },
  };
}

export const SHAREPOINT_PNP_SCRIPT = `# 🚀 PnP PowerShell — provision the "ITSM_Weekly_Updates" list (creates it if missing)
# Target: ${OGRP_SITE}
# List: ${WEEKLY_UPDATES_LIST}  (custom list — the system-of-record row per week)
#
# This is what Flow B (When an item is created on ${DISPATCH_QUEUE_LIST}) writes to.
# It does NOT touch "${SERVICE_DELIVERY_LIBRARY}" — that library only holds the
# generated .docx file; Flow B links to it via Report_Doc_Url below.
#
# PREREQUISITE (run once as Administrator if Connect-PnPOnline is not recognized):
#   Install-Module PnP.PowerShell -Scope CurrentUser -Force
#   # If that fails under corporate policy, use -Scope AllUsers as Admin, or
#   # add the columns manually in the SharePoint UI (see walkthrough).
#
# Safe to re-run: existing list/columns are skipped, not duplicated.

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "❌ PnP.PowerShell is not installed." -ForegroundColor Red
    Write-Host "   Run once:  Install-Module PnP.PowerShell -Scope CurrentUser -Force" -ForegroundColor Yellow
    Write-Host "   Then close/reopen PowerShell and re-run this script." -ForegroundColor Yellow
    return
}
Import-Module PnP.PowerShell -ErrorAction Stop

Connect-PnPOnline -Url "${OGRP_SITE}" -Interactive

$list = "${WEEKLY_UPDATES_LIST}"

# Create the list if it doesn't exist yet — a plain generic list (BaseTemplate 100)
try {
    $null = Get-PnPList -Identity $list -ErrorAction Stop
    Write-Host "Found list '$list'." -ForegroundColor Cyan
} catch {
    Write-Host "List '$list' not found — creating it..." -ForegroundColor Yellow
    New-PnPList -Title $list -Template GenericList | Out-Null
    Write-Host "✓ List '$list' created." -ForegroundColor Green
}

function Add-ColumnIfMissing {
    param([string]$DisplayName, [string]$InternalName, [string]$Type, [string[]]$Choices)
    $existing = Get-PnPField -List $list -Identity $InternalName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  · $InternalName already exists — skipped" -ForegroundColor DarkGray
        return
    }
    try {
        if ($Choices) {
            Add-PnPField -List $list -DisplayName $DisplayName -InternalName $InternalName -Type $Type -Choices $Choices | Out-Null
        } else {
            Add-PnPField -List $list -DisplayName $DisplayName -InternalName $InternalName -Type $Type | Out-Null
        }
        Write-Host "  ✓ $InternalName added" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ $InternalName FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Provisioning columns on '$list' ..." -ForegroundColor Cyan

Add-ColumnIfMissing -DisplayName "Items_JSON"          -InternalName "Items_JSON"          -Type "Note"
Add-ColumnIfMissing -DisplayName "Completed_Snapshot"  -InternalName "Completed_Snapshot"  -Type "Note"
Add-ColumnIfMissing -DisplayName "Priorities_Snapshot" -InternalName "Priorities_Snapshot" -Type "Note"
Add-ColumnIfMissing -DisplayName "RAG_Status"          -InternalName "RAG_Status"          -Type "Choice" -Choices @("Green","Yellow","Red")
Add-ColumnIfMissing -DisplayName "Major_Incidents"     -InternalName "Major_Incidents"     -Type "Number"
Add-ColumnIfMissing -DisplayName "Alert_Detection"     -InternalName "Alert_Detection"     -Type "Number"
Add-ColumnIfMissing -DisplayName "Window_Closed_At"    -InternalName "Window_Closed_At"    -Type "DateTime"
Add-ColumnIfMissing -DisplayName "Metrics_JSON"        -InternalName "Metrics_JSON"        -Type "Note"
Add-ColumnIfMissing -DisplayName "Metrics_Analysis"    -InternalName "Metrics_Analysis"    -Type "Note"
Add-ColumnIfMissing -DisplayName "Report_Doc_Url"      -InternalName "Report_Doc_Url"      -Type "URL"

Write-Host ""
Write-Host "Done. Open the list → + Add column (or List settings → Columns)" -ForegroundColor Cyan
Write-Host "and confirm these internal names exist: Items_JSON, Metrics_JSON," -ForegroundColor Cyan
Write-Host "Metrics_Analysis, RAG_Status, Window_Closed_At, Major_Incidents," -ForegroundColor Cyan
Write-Host "Alert_Detection, Completed_Snapshot, Priorities_Snapshot, Report_Doc_Url." -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: '${SERVICE_DELIVERY_LIBRARY}' is untouched by this script — it's the" -ForegroundColor Cyan
Write-Host "existing document library where Flow B saves the generated .docx file." -ForegroundColor Cyan
`;

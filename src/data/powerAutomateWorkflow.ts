import {
  FlowCardFormData, PowerAutomateStep,
  activeItems, completedItems, itemsByPillar, PILLARS, PillarType,
} from '../types/itsm';

export const POWER_AUTOMATE_STEPS: PowerAutomateStep[] = [
  {
    id: 'step_1', title: '1. Recurrence · Monday 08:00 — open the window', type: 'trigger', connector: 'PowerAutomate',
    description: 'Fires every Monday 08:00. Seeds the card with last week’s carry (active) + closed wins (Section 1).',
    details: 'Initializes the submission window [Mon 08:00 → next Mon 07:00] and posts a fresh FlowCard pre-filled from the SharePoint snapshot of the previous week.',
    inputs: { Frequency: 'Week', Interval: '1', WeekDay: 'Monday', Time: '08:00', Window_Close: 'next Monday 07:00' },
    icon: 'Clock',
  },
  {
    id: 'step_2', title: '2. Post Adaptive Card & wait (window stays open)', type: 'action', connector: 'Teams',
    description: 'Section 1 = completed items w/ an Archive tick · Section 2 = active items w/ a Complete toggle + RAG + new-entry slots.',
    details: 'The card remains live and editable until the window closes. Each item round-trips its {text, rag, complete, archived, pillar}.',
    inputs: { 'Post as': 'Flow bot', 'Post in': 'Channel: ITSM Weekly Updates', 'Wait timeout': 'until Window_Close (Mon 07:00)' },
    outputs: ['data.items[] { id, pillar, text, rag, complete, archived }', 'data.majorIncidents', 'data.alertDetectionRate'],
    icon: 'MessageSquare',
  },
  {
    id: 'step_3', title: '3. Delay until window close · Monday 07:00', type: 'action', connector: 'Control',
    description: 'Holds the branch open for the full 6d 23h window, then releases to finalize.',
    details: 'At Mon 07:00 the card flips to “Closed for submission”. Late edits are rejected; the captured snapshot is finalized.',
    inputs: { Wait_until: '@{addDays(startOfWeek(utcNow()), 7, "yyyy-MM-ddT07:00:00Z")}' },
    icon: 'Zap',
  },
  {
    id: 'step_4', title: '4. Parse response → item array', type: 'action', connector: 'Dataverse',
    description: 'Strongly-types the items[] payload (per-item RAG, complete, archived, pillar).',
    details: 'Feeds the Compose + SharePoint actions. Archived items are separated for the history write; active+completed drive the report.',
    inputs: { Content: "@body('Post_card')?['data']", Schema: 'items[]: { id, pillar, text, rag, complete, archived }' },
    icon: 'Code',
  },
  {
    id: 'step_5', title: '5. Compose · auto Overall RAG', type: 'action', connector: 'Control',
    description: 'Worst of (active items’ RAGs ∪ KPI RAGs). Completed & archived excluded.',
    details: 'if contains red ⇒ red · else if contains yellow ⇒ yellow · else green. Never a manual field.',
    inputs: { Expression: "@if(contains(join(...activeRags∪kpiRags,','),'red'),'red',if(contains(...,'yellow'),'yellow','green'))" },
    outputs: ['OverallRag'],
    icon: 'Zap',
  },
  {
    id: 'step_6', title: '6. SharePoint · write weekly item', type: 'action', connector: 'SharePoint',
    description: 'Persists Items_JSON + human snapshots + auto RAG + window-closed timestamp.',
    details: 'One row per week in ITSM_Weekly_Updates; the Items_JSON column is the round-trippable source for next Monday’s seed.',
    inputs: { List: 'ITSM_Weekly_Updates', Items_JSON: '@{...items}', RAG_Status: "@outputs('Compose_Overall')", Window_Closed_At: '@{utcNow()}' },
    icon: 'Database',
  },
  {
    id: 'step_7', title: '7. Post “Closed for submission” card', type: 'action', connector: 'Teams',
    description: 'Locks the channel card read-only and stamps the finalized RAG.',
    details: 'Replaces the editable card with a published summary; inputs disabled; shows “reopens Mon 08:00”.',
    inputs: { 'Post in': 'Channel: ITSM Weekly Updates', Theme: 'Closed / read-only' },
    icon: 'Send',
  },
  {
    id: 'step_8', title: '8. Outlook · executive digest', type: 'action', connector: 'Outlook',
    description: 'HTML digest: completed wins, live priorities w/ RAG, KPI table, auto overall.',
    details: 'Sent to the configured recipient (single test mailbox while wiring) with a deep-link to the SharePoint row.',
    inputs: { To: 'patrickharvey.gaddi@ingrammicro.com', Subject: '📊 ITSM Weekly Status – @{reportWeek} | RAG @{OverallRag}' },
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

/* ── Cloud Flow definition (Logic Apps schema) ─────────────────────────── */
export function generatePowerAutomateFlowDefinitionJson(): object {
  const itemSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' }, pillar: { type: 'string', enum: ['People', 'Process', 'Technology'] },
      text: { type: 'string' }, rag: { type: 'string', enum: ['green', 'yellow', 'red', 'na'] },
      complete: { type: 'boolean' }, archived: { type: 'boolean' },
    },
  };
  return {
    $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
    contentVersion: '3.0.0.0',
    parameters: {
      $connections: { defaultValue: {}, type: 'Object' },
      SharePointSiteUrl: { defaultValue: 'https://ingrammicro.sharepoint.com/sites/ITSM-Operations', type: 'String' },
      TeamsChannelId: { defaultValue: '19:itsm-weekly-updates-channel@thread.tacv2', type: 'String' },
    },
    triggers: {
      Recurrence_Monday_0800_Open_Window: {
        type: 'Recurrence',
        recurrence: { frequency: 'Week', interval: 1, schedule: { weekDays: ['Monday'], hours: ['8'], minutes: [0] }, timeZone: 'UTC' },
      },
    },
    actions: {
      Post_Adaptive_Card_and_Wait: {
        type: 'OpenApiConnectionWebhook',
        inputs: {
          host: { connectionName: 'shared_teams', operationId: 'PostAdaptiveCardAndWaitForResponse', apiId: '/providers/Microsoft.PowerApps/apis/shared_teams' },
          parameters: { poster: 'Flow bot', location: 'Channel', 'body/recipient/groupId': "@parameters('TeamsChannelId')", 'body/card': "@variables('AdaptiveCardBody')" },
        },
        runAfter: {},
      },
      Delay_until_Window_Close_Mon_0700: {
        type: 'Wait',
        inputs: { until: "@addDays(startOfWeek(utcNow(),'Monday'), 7, 'yyyy-MM-ddT07:00:00Z')" },
        runAfter: { Post_Adaptive_Card_and_Wait: ['Succeeded', 'TimedOut'] },
      },
      Parse_Items_Response: {
        type: 'ParseJson',
        inputs: {
          content: "@body('Post_Adaptive_Card_and_Wait')?['data']",
          schema: {
            type: 'object',
            properties: {
              reportWeek: { type: 'string' },
              majorIncidents: { type: 'number' }, alertDetectionRate: { type: 'number' },
              items: { type: 'array', items: itemSchema },
            },
          },
        },
        runAfter: { Delay_until_Window_Close_Mon_0700: ['Succeeded'] },
      },
      Compose_Auto_Overall_RAG: {
        type: 'Compose',
        inputs: "@if(contains(join(variables('ActiveAndKpiRags'),','),'red'),'red',if(contains(join(variables('ActiveAndKpiRags'),','),'yellow'),'yellow','green'))",
        runAfter: { Parse_Items_Response: ['Succeeded'] },
      },
      Create_SharePoint_Weekly_Item: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_sharepointonline', operationId: 'PostItem', apiId: '/providers/Microsoft.PowerApps/apis/shared_sharepointonline' },
          parameters: {
            dataset: "@parameters('SharePointSiteUrl')", table: 'ITSM_Weekly_Updates',
            "item/Title": "@{body('Parse_Items_Response')?['reportWeek']}",
            "item/Items_JSON": "@{body('Parse_Items_Response')?['items']}",
            "item/RAG_Status": "@outputs('Compose_Auto_Overall_RAG')",
            "item/Metrics_JSON": "@variables('MetricsJson')",
            "item/Metrics_Analysis": "@variables('MetricsAnalysis')",
            "item/Window_Closed_At": '@{utcNow()}',
          },
        },
        runAfter: { Compose_Auto_Overall_RAG: ['Succeeded'] },
      },
      Post_Closed_For_Submission_Card: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_teams', operationId: 'PostCardInChannel', apiId: '/providers/Microsoft.PowerApps/apis/shared_teams' },
          parameters: { poster: 'Flow bot', 'body/recipient/groupId': "@parameters('TeamsChannelId')", 'body/card': "@variables('ClosedCard')" },
        },
        runAfter: { Create_SharePoint_Weekly_Item: ['Succeeded'] },
      },
      Send_Executive_Digest: {
        type: 'OpenApiConnection',
        inputs: {
          host: { connectionName: 'shared_office365', operationId: 'SendEmailV2', apiId: '/providers/Microsoft.PowerApps/apis/shared_office365' },
          parameters: {
            "emailMessage/To": 'patrickharvey.gaddi@ingrammicro.com',
            "emailMessage/Subject": "📊 ITSM Weekly Status – @{body('Parse_Items_Response')?['reportWeek']} | RAG @{upper(outputs('Compose_Auto_Overall_RAG'))}",
            "emailMessage/Body": '<p>Weekly ITSM status finalized at window close. KPI snapshot, per-metric analyst reads, completed wins and live priorities are appended below; the full item array + notes are archived to SharePoint (Metrics_JSON / Items_JSON).</p>',
          },
        },
        runAfter: { Post_Closed_For_Submission_Card: ['Succeeded'] },
      },
    },
  };
}

export const SHAREPOINT_PNP_SCRIPT = `# 🚀 PnP PowerShell — extend the EXISTING "ITSM Service Delivery" library
# Target: https://ingrammicro.sharepoint.com/sites/OGRP-TigerTeam-IOCPhilippines-InformationTechnology
# Library: ITSM Service Delivery  (document library — NOT a custom list)
#
# PREREQUISITE (run once as Administrator if Connect-PnPOnline is not recognized):
#   Install-Module PnP.PowerShell -Scope CurrentUser -Force
#   # If that fails under corporate policy, use -Scope AllUsers as Admin, or
#   # add the columns manually in the SharePoint UI (see walkthrough).
#
# Safe to re-run: existing columns are skipped, not duplicated.

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "❌ PnP.PowerShell is not installed." -ForegroundColor Red
    Write-Host "   Run once:  Install-Module PnP.PowerShell -Scope CurrentUser -Force" -ForegroundColor Yellow
    Write-Host "   Then close/reopen PowerShell and re-run this script." -ForegroundColor Yellow
    return
}
Import-Module PnP.PowerShell -ErrorAction Stop

Connect-PnPOnline -Url "https://ingrammicro.sharepoint.com/sites/OGRP-TigerTeam-IOCPhilippines-InformationTechnology" -Interactive

$library = "ITSM Service Delivery"

# Confirm the library exists before touching anything
try {
    $null = Get-PnPList -Identity $library -ErrorAction Stop
    Write-Host "Found library '$library'." -ForegroundColor Cyan
} catch {
    Write-Host "❌ Library '$library' not found on this site. Check the name and try again." -ForegroundColor Red
    return
}

function Add-ColumnIfMissing {
    param([string]$DisplayName, [string]$InternalName, [string]$Type, [string[]]$Choices)
    $existing = Get-PnPField -List $library -Identity $InternalName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  · $InternalName already exists — skipped" -ForegroundColor DarkGray
        return
    }
    try {
        if ($Choices) {
            Add-PnPField -List $library -DisplayName $DisplayName -InternalName $InternalName -Type $Type -Choices $Choices | Out-Null
        } else {
            Add-PnPField -List $library -DisplayName $DisplayName -InternalName $InternalName -Type $Type | Out-Null
        }
        Write-Host "  ✓ $InternalName added" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ $InternalName FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Provisioning columns on '$library' ..." -ForegroundColor Cyan

Add-ColumnIfMissing -DisplayName "Items_JSON"          -InternalName "Items_JSON"          -Type "Note"
Add-ColumnIfMissing -DisplayName "Completed_Snapshot"  -InternalName "Completed_Snapshot"  -Type "Note"
Add-ColumnIfMissing -DisplayName "Priorities_Snapshot" -InternalName "Priorities_Snapshot" -Type "Note"
Add-ColumnIfMissing -DisplayName "RAG_Status"          -InternalName "RAG_Status"          -Type "Choice" -Choices @("Green","Yellow","Red")
Add-ColumnIfMissing -DisplayName "Major_Incidents"     -InternalName "Major_Incidents"     -Type "Number"
Add-ColumnIfMissing -DisplayName "Alert_Detection"     -InternalName "Alert_Detection"     -Type "Number"
Add-ColumnIfMissing -DisplayName "Window_Closed_At"    -InternalName "Window_Closed_At"    -Type "DateTime"
Add-ColumnIfMissing -DisplayName "Metrics_JSON"        -InternalName "Metrics_JSON"        -Type "Note"
Add-ColumnIfMissing -DisplayName "Metrics_Analysis"    -InternalName "Metrics_Analysis"    -Type "Note"

Write-Host ""
Write-Host "Done. Open the library → + Add column (or List settings → Columns)" -ForegroundColor Cyan
Write-Host "and confirm these internal names exist: Items_JSON, Metrics_JSON," -ForegroundColor Cyan
Write-Host "Metrics_Analysis, RAG_Status, Window_Closed_At, Major_Incidents," -ForegroundColor Cyan
Write-Host "Alert_Detection, Completed_Snapshot, Priorities_Snapshot." -ForegroundColor Cyan
`;

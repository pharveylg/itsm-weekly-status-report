/**
 * Single source of truth for where this studio reads/writes in SharePoint.
 *
 * Every REST call in the app must import these instead of re-hardcoding the
 * site URL — previously it was copy-pasted across App.tsx, M365ConnectionKit
 * and TeamWeeklyDocReport, and a site move meant hunting down three separate
 * literals.
 */
export const OGRP_SITE = 'https://ingrammicro.sharepoint.com/sites/OGRP-TigerTeam-IOCPhilippines-InformationTechnology';
export const OGRP_SITE_RELATIVE = '/sites/OGRP-TigerTeam-IOCPhilippines-InformationTechnology';

/** Dispatch ticket queue — Flow B's trigger. Plain SharePoint list writes, so it's DLP-safe. */
export const DISPATCH_QUEUE_LIST = 'ITSM_Dispatch_Queue';

/** System-of-record list: one row per finalized week (Items_JSON, Metrics_JSON, RAG_Status, ...). */
export const WEEKLY_UPDATES_LIST = 'ITSM_Weekly_Updates';

/** Existing document library where the generated weekly Word doc lands. */
export const SERVICE_DELIVERY_LIBRARY = 'ITSM Service Delivery';

/**
 * Cross-origin fallback: dispatch-runner.html must be uploaded to this exact
 * path (Site Assets, alongside index.html) so the studio can open it in a
 * popup when it isn't itself running same-origin. See M365ConnectionKit's
 * download button and dispatchRunner.ts for the popup protocol.
 */
export const DISPATCH_RUNNER_URL = `${OGRP_SITE}/SiteAssets/dispatch-runner.html`;

export const DEFAULT_RECIPIENT = 'patrickharvey.gaddi@ingrammicro.com';

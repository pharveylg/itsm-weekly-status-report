# ITSM Studio: GitHub Build and SharePoint Deployment

## Repository model

GitHub stores the source code. Do not deploy the small `index.html` from the
repository root: it is only Vite's development shell and references
`/src/main.tsx`.

The GitHub Action in `.github/workflows/build-studio.yml` creates the production
artifact. It is a self-contained `dist/index.html` containing the JavaScript and
CSS inline.

## Upload the project to GitHub

1. Create a repository in GitHub.
2. Upload the complete project source, including the hidden `.github` folder.
3. Commit to `main`.
4. Open the repository's **Actions** tab.
5. Select **Build ITSM Studio**.
6. Wait for the green check.

If Actions are restricted by company policy, run `npm install` and
`npm run build` locally instead.

## Download the production artifact

1. Open **Actions** in the repository.
2. Open the latest successful **Build ITSM Studio** run.
3. Scroll to **Artifacts**.
4. Download **itsm-studio-sharepoint-build**.
5. Extract the downloaded ZIP.
6. The extracted `index.html` is the production file to deploy.

The artifact is retained for 30 days. The workflow can also be run manually:
**Actions > Build ITSM Studio > Run workflow**.

## Deploy to the SharePoint-hosted studio page

1. Open the OGRP site's Site Assets library.
2. Replace the existing studio `index.html` with the production artifact.
3. Keep the SharePoint modern page's Embed web part pointed at that file.
4. Publish or republish the SharePoint page.
5. Hard-refresh the published page with `Ctrl+F5`.
6. Verify the **M365 Connections** tab can see `ITSM_Dispatch_Queue`.
7. Run a test to Patrick before changing the Outlook recipient.

## Share the repository for review

Send the public GitHub repository URL, for example:

`https://github.com/OWNER/REPOSITORY`

The coding assistant can read public repositories and inspect source files.
It cannot authenticate to a private repository, accept GitHub credentials, or
push commits to your GitHub account. Changes are made in the coding workspace;
you then download the updated source, push it to GitHub, and let the Action
produce the next deployment artifact.

For a private corporate repository, paste the relevant files into the coding
workspace or provide a public mirror with secrets removed.

## Safe release loop

1. Push source changes to GitHub.
2. Confirm the Action build is green.
3. Download `itsm-studio-sharepoint-build`.
4. Replace the SharePoint Site Assets `index.html`.
5. Hard-refresh and test in SharePoint.
6. Keep Outlook pointed to `patrickharvey.gaddi@ingrammicro.com` until the
   complete workflow has passed repeated tests.

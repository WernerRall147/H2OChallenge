# Battle H2O

A fun, mobile-first water challenge for two players. Track daily 500ml glasses, occasional weigh-ins, profile photos, prizes, and the final winner across two 14-day rounds.

## Play

**Game link:** [Open Battle H2O](https://wernerrall147.github.io/H2OChallenge/)

Open the link in Safari or Chrome on your phone. Once deployed, you can also use your browser's **Add to Home Screen** option for quick access (an internet connection is still needed).

**First-time publishing:** the link only works after GitHub Pages is enabled and the deployment below has succeeded.

The app saves scores and photos only in the current browser on the current device. Both players use the same device; tap the avatar at the top to switch players. Sharing the link does **not** sync a challenge between phones. Clearing browser data or using private browsing can lose your scores.

Use **More → Download CSV** before ending a challenge, and **More → Copy link** to share the app. The CSV exports scores and weights, not photos, and cannot be imported back into the app.

## Publish the phone link

If your GitHub plan requires a public repository for Pages, complete the privacy checklist below **before** changing visibility. Making the repository public exposes source code and history, not just the playable app. `private: true` in `package.json` prevents accidental npm publication; it does not control GitHub visibility and should stay enabled.

1. In this repository, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.
2. Merge these changes into `main`. The **Deploy to GitHub Pages** workflow builds and publishes the app automatically on pushes to `main`. You can also run it manually from **Actions**, selecting `main`.
3. Wait for the workflow's **deploy** job to succeed, then open the game link above. If it shows a 404, check the Pages setting and deployment status first.

Pull requests build the app for verification but do not publish it. Vite's base path is configured for `/H2OChallenge/`, so JavaScript and CSS load correctly from the repository's Pages URL.

### Before making the repository public

- Review **all branches and tags and their full commit history**, including commit author names/emails. Deleting a file in the latest commit does not remove it from history. GitHub usernames and repository URLs remain public identifiers; use GitHub's private/noreply commit email for future commits if desired.
- Review issues, pull requests, comments, screenshots, attachments, releases, Actions logs and artifacts for personal information. These are not covered by a source-file scan. Remove sensitive content before publication; for exposed credentials, revoke/rotate them first and follow GitHub's sensitive-data removal guidance. Do not assume switching back to private retracts copies.
- Never commit real player data, photos, CSV exports, `.env` files or tokens. Ignore rules help prevent accidental additions but do not sanitize files already tracked or their history.
- In **Settings → Code security** (the label may vary), enable the dependency graph, Dependabot alerts/security updates, secret scanning and push protection where available. Recheck after switching to public because availability depends on visibility/plan. Review and resolve alerts; secret scanning is not a general PII detector.
- This repository includes weekly Dependabot updates for npm and GitHub Actions, a dependency audit on builds, and a production build on pull requests. Require the build check on `main` using a branch rule/ruleset where available, review dependency updates, and restrict the `github-pages` environment to `main`.
- Only `dist/` is published as the Pages artifact. Do not add personal files or secrets to source code, `public/`, or `VITE_*` variables: Vite exposes those variables in the browser bundle.

No automated scan can certify that a repository contains no PII. Complete the history and GitHub-content review before approving publication.

### Publish from Azure Cloud Shell on iOS

Azure login does **not** authenticate you to GitHub. Use the Bash console in Safari and a separate browser tab for GitHub's device sign-in. No local iOS terminal, Azure deployment, or saved personal access token is required.

1. Check that GitHub CLI is available with `gh --version`. If it is missing, use the [official GitHub CLI installation instructions](https://github.com/cli/cli#installation), or use GitHub's web settings instead. Never paste a token into chat.
2. Authenticate as a repository administrator. An isolated temporary CLI configuration avoids storing the session in your normal Cloud Shell home configuration:

   ```bash
   unset GH_TOKEN GITHUB_TOKEN
   export GH_CONFIG_DIR="$(mktemp -d)"
   gh auth login --hostname github.com --git-protocol https --web
   gh auth status --hostname github.com
   ```

   Open the displayed device-login URL in another Safari tab and enter the one-time code there. Keep that code private. The CLI may store credentials unencrypted inside the temporary directory; use only your own trusted Cloud Shell session and log out when finished.
3. Merge the reviewed privacy/publishing changes into `main` first. Verify the repository before the visibility change:

   ```bash
   gh repo view WernerRall147/H2OChallenge --json nameWithOwner,visibility,url
   ```

4. **Stop unless the privacy checklist is complete.** The next command makes the repository and its history public and explicitly accepts GitHub's visibility-change consequences:

   ```bash
   gh repo edit WernerRall147/H2OChallenge --visibility public --accept-visibility-change-consequences
   gh repo view WernerRall147/H2OChallenge --json visibility,url
   ```

   Alternatively, use **Settings → General → Danger Zone → Change repository visibility** on GitHub, requesting the desktop website in Safari if needed.
5. Enable a new Pages site with GitHub Actions as the source:

   ```bash
   gh api --method POST repos/WernerRall147/H2OChallenge/pages -f build_type=workflow
   ```

   If GitHub says a Pages site already exists, inspect it with `gh api repos/WernerRall147/H2OChallenge/pages`. Only if its `build_type` is not `workflow`, change it with `gh api --method PUT repos/WernerRall147/H2OChallenge/pages -f build_type=workflow`. For access/plan errors, check administrator permissions and visibility instead of retrying blindly.
6. Verify the source, then start deployment:

   ```bash
   gh api repos/WernerRall147/H2OChallenge/pages --jq '{build_type,html_url}'
   gh workflow run deploy-pages.yml --repo WernerRall147/H2OChallenge --ref main
   gh run list --repo WernerRall147/H2OChallenge --workflow deploy-pages.yml --limit 5
   ```

   Confirm the **deploy** job succeeds in GitHub Actions before opening the game link. These commands do not require a repository checkout or Node.js in Cloud Shell.
7. Log out of the temporary CLI session:

   ```bash
   gh auth logout --hostname github.com
   unset GH_CONFIG_DIR
   ```

   For one-time access, you can also revoke **GitHub CLI** under GitHub **Settings → Applications → Authorized OAuth Apps** (this affects other sessions using that authorization). Never leave an administrator token in an Actions secret after Pages setup.

On iOS, open the game link in Safari and use **Share → Add to Home Screen**. This is a static browser app, not an App Store release; it still needs an internet connection.

### Player privacy

- Use nicknames rather than real names. Photos and weight entries are optional. The app stores the challenge in browser `localStorage`; it has no account system, backend database, analytics, or third-party font requests.
- Data is not encrypted by the app. Anyone using the same browser profile, or scripts on the same web origin, may access it. Player switching and opponent peeks are game rules, **not** access controls. GitHub project sites under the same `username.github.io` origin share browser storage; use a dedicated origin if hosting other untrusted apps there.
- GitHub serves the site and can receive normal request metadata such as IP addresses; local-only challenge storage does not mean anonymous hosting.
- **More → End & delete** removes this app's saved challenge, including names, photos and weights, from that browser profile. It does not delete downloaded CSVs, original photos, screenshots or device backups. Downloaded CSVs contain player names and weights; keep them private and delete them separately when no longer needed.
- Sharing the app link does not upload or synchronize player data. Making the source repository public does not upload existing browser-stored challenges.

### Enable Pages from the command line

Run `npm run pages:enable` from the repository root using Node.js 22.12 or newer. No dependency installation is needed for this script.

The script targets `WernerRall147/H2OChallenge`. It creates a missing Pages site, switches an existing branch-built site to **GitHub Actions**, and leaves an already-configured site unchanged. It verifies the resulting configuration but does not deploy the app.

Supply an administrator-authorized token through the `GH_TOKEN` environment variable. A fine-grained token must be scoped to this repository with **Pages: Read and write** and **Administration: Read and write** permissions. The Actions `GITHUB_TOKEN` cannot enable Pages.

If you use GitHub CLI, authenticate with `gh auth login` using an account/token with those permissions, then run:

```bash
GH_TOKEN="$(gh auth token)" npm run pages:enable
```

Alternatively, inject `GH_TOKEN` through your shell or secret manager. Never save a token in source files or paste it into a command that will be stored in shell history. Revoke temporary setup tokens after use.

After the script succeeds, run **Deploy to GitHub Pages** from **Actions**, selecting `main`.

### Deployment fails with `404 Not Found`

If `Configure GitHub Pages` reports `Get Pages site failed` / `Not Found`, or `Deploy site` reports `Failed to create deployment (status: 404)` and `Ensure GitHub Pages has been enabled`, verify that Pages is enabled for the repository and the workflow has access. A successful build and artifact upload do not enable Pages.

1. A repository administrator must open [Settings → Pages](https://github.com/WernerRall147/H2OChallenge/settings/pages) and select **GitHub Actions** under **Build and deployment → Source**.
2. After saving that setting, open the failed workflow run in **Actions** and select **Re-run failed jobs**, or manually run **Deploy to GitHub Pages** on `main`.

No additional token is needed when an administrator enables Pages through Settings (recommended). The workflow's `GITHUB_TOKEN` cannot perform first-time enablement.

Alternatively, an administrator can opt into automatic first-time enablement:

1. Create a fine-grained personal access token scoped only to this repository, with **Pages: Read and write** and **Administration: Read and write** permissions. The token owner must have permission to manage the repository's Pages settings.
2. Save it as the Actions repository secret `PAGES_ENABLEMENT_TOKEN` under **Settings → Secrets and variables → Actions**. Never put the token in a workflow file.
3. Run **Deploy to GitHub Pages** on `main`. The configure step uses this secret to create a missing Pages site with GitHub Actions as its source; the deployment step still uses `GITHUB_TOKEN`.
4. After successful enablement, delete the secret and revoke the token; subsequent deployments use `GITHUB_TOKEN`.

Workflow automatic enablement does not switch an existing branch-built Pages site to GitHub Actions. Change that site's source in **Settings → Pages** or use `npm run pages:enable` instead. Without the optional secret, a missing or inaccessible Pages site still fails the job; it is not treated as a successful deployment.

## Run locally

```bash
npm ci
npm run dev
```

Use Node.js 22.12 or newer. Open the local URL printed by Vite.

Build the static site with `npm run build`; the deployable files are in `dist/`. To check the production build locally, run `npm run preview` and open the printed `/H2OChallenge/` URL.

# Cliff Goat feedback automation

This system is limited to the non-monetary prototype. The default branch contains the trusted worker; only `codex/feedback-development` receives automatic game changes. There is no production deployment.

## Storage and states

n8n's **Cliff Goat Feedback** data table stores every accepted submission before AI work. `received` rows are picked up by the controller; `processing` means an AI attempt started; terminal states include `queued`, `duplicate`, `needs_details`, `ignored`, `review_required`, and `ai_failed`. A stale `processing` row is marked `ai_failed` rather than automatically spending again. Reset such a row to `received` only after inspecting it.

GitHub issues beginning `<!-- cliff-goat-task:v1 -->` are the persistent task queue. Labels `cg-queued`, `cg-running`, `cg-integrated`, `cg-failed`, `cg-review`, and `cg-no-change` record development outcomes. Priority labels order bugs ahead of suggestions. Report counts use stored submissions and machine-readable result comments, never model estimates. Anonymous player identifiers are self-reported; they do not establish verified unique humans.

The `codex/feedback-state` branch stores a compare-and-swap controller lease. A 10-minute lease prevents concurrent triage; the controller times out after 8 minutes. A daily limit permits 30 triage attempts. AI errors are retained without automatic paid retry. GitHub's global workflow concurrency serializes coding and integration. There are at most five coding attempts per UTC day, each limited to 20 minutes. Failed tasks never automatically requeue. Scheduled n8n recovery polls every minute and checks the coding budget before dispatch; GitHub does not run idle cron jobs. These schedules do not wait for the weekly report. The local n8n host must be running for intake, scheduling and recovery.

## Integration safety

Codex runs on an isolated runner with read-only repository permissions, no persisted Git credential, workspace-write sandbox, and dropped sudo. Feedback and AI-generated instructions are untrusted data. A separate job validates the patch against the trusted default-branch policy. Only existing `audio.js`, `music.js`, `scene.js`, and `styles.css` may change automatically. All other files, including `app.js`, `index.html`, `engine.js`, tests, server, dependencies, workflows and infrastructure, require human review. This deliberately routes some UI bugs to review when UI and balance code share a file.

The gate rejects protected terms, network/execution primitives, binary patches, renames, file additions/removals, and changes exceeding 250 lines or 80 KB. A separate read-only Codex review must explicitly approve the patch's scope and behavior before independent tests and syntax checks run in a job without write credentials. Each attempted fix therefore uses one development invocation and, when it proposes an eligible patch, one review invocation. The publisher never executes modified game code; it applies the verified patch to the exact tested base and makes a fast-forward push. Any concurrent development-branch update fails closed. Each commit carries `[cg-task:N]` for crash recovery. Restricted or failing patches remain downloadable artifacts for 30 days.

## Play the development version

Check out `codex/feedback-development`, run `npm start`, and open `http://localhost:4285`. Every integrated change passes `npm test` and `npm run check`. No public hosting URL has been configured; reports must not invent one.

## Required settings and final checks

Keep the existing n8n OpenAI and GitHub credentials. The GitHub credential must allow issues and Actions dispatch. Configure GitHub Actions secret `OPENAI_API_KEY`; n8n's credential is not automatically shared with GitHub. The original workflow is preserved and should not receive the new form's submissions.

Connect the same Gmail OAuth credential in Read Connected Gmail Address and Send Developer Email before publishing the report. It sends to the connected Gmail account. Its intended schedule is Monday 10:00 Asia/Tbilisi. Keep AI processing unpublished until credits are restored and final testing is ready. The local n8n form is reachable only where this n8n instance is reachable; no public tunnel is created.

Final tests: form persistence; unclear/irrelevant/protected reports; semantic duplicates and reporter count; simultaneous submissions and lease contention; credit error retention; queue priority; successful audio/CSS patch; protected-path rejection; failing checks; branch conflict; cancellation/recovery; no-change result; weekly counts and Gmail delivery. Remove only your own test data after testing.

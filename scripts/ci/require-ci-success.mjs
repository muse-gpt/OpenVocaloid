/**
 * Publish gate: require a green `ci.yml` run on the exact tag-peeled commit.
 *
 * Contract (release gate, not a convenience check):
 * - A failed workflow can never pass. An earlier success on the same SHA must
 *   not mask a later completed failure (re-run, new run, different event).
 * - Missing, skipped, cancelled and timed-out runs are not success.
 * - Only runs whose headSha equals the bound tag SHA are considered.
 *
 * Usage: TAG_SHA=… node scripts/ci/require-ci-success.mjs [--sha=…]
 * The repo is taken from GITHUB_REPOSITORY.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = process.env.GITHUB_REPOSITORY || process.env.OPEN_VOICE_GITHUB_REPO || '';
const TAG_SHA = String(process.env.TAG_SHA || process.argv.find((a) => a.startsWith('--sha='))?.slice(6) || '')
    .trim()
    .toLowerCase();
const WORKFLOW = process.env.CI_WORKFLOW_FILE || 'ci.yml';
const TIMEOUT_MS = Number(process.env.CI_WAIT_TIMEOUT_MS || 45 * 60 * 1000);
const INTERVAL_MS = Number(process.env.CI_WAIT_INTERVAL_MS || 20 * 1000);

const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'pending', 'requested', 'waiting']);

/**
 * Decide the gate from run metadata only (no I/O), so fixtures can drive it.
 *
 * @param {{ sha: string, runs: Array<object> }} input
 * @returns {{ok: boolean, state: string, runId?: number, conclusion?: string|null, active?: number}}
 */
export function evaluateGate({ sha, runs }) {
    const scoped = (runs ?? []).filter((run) => String(run?.headSha ?? '').toLowerCase() === sha);
    if (scoped.length === 0) {
        return { ok: false, state: 'no-runs' };
    }
    const active = scoped.filter((run) => ACTIVE_STATUSES.has(String(run.status)));
    if (active.length > 0) {
        return { ok: false, state: 'active', active: active.length };
    }
    const completed = scoped
        .filter((run) => String(run.status) === 'completed')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (b.databaseId ?? 0) - (a.databaseId ?? 0));
    if (completed.length === 0) {
        return { ok: false, state: 'no-completed' };
    }
    const newest = completed[0];
    if (newest.conclusion !== 'success') {
        return { ok: false, state: 'run-not-success', runId: newest.databaseId, conclusion: newest.conclusion ?? null };
    }
    return { ok: true, state: 'success', runId: newest.databaseId };
}

function fail(msg) {
    console.error(`require-ci-success: ${msg}`);
    process.exit(1);
}

function gh(args) {
    const r = spawnSync('gh', args, {
        encoding: 'utf8',
        shell: false,
        env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '' },
    });
    if (r.status !== 0) {
        fail(r.stderr?.trim() || r.stdout?.trim() || `gh ${args.join(' ')} exit ${r.status}`);
    }
    return String(r.stdout ?? '').trim();
}

function listRuns() {
    const raw = gh([
        'run',
        'list',
        '--repo',
        REPO,
        '--commit',
        TAG_SHA,
        '--workflow',
        WORKFLOW,
        '--limit',
        '20',
        '--json',
        'databaseId,status,conclusion,createdAt,event,headSha',
    ]);
    try {
        return JSON.parse(raw);
    } catch {
        fail(`invalid gh json: ${raw.slice(0, 200)}`);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    if (!REPO) fail('GITHUB_REPOSITORY is required');
    if (!/^[0-9a-f]{40}$/.test(TAG_SHA)) fail(`TAG_SHA must be 40-char hex (got '${TAG_SHA || '(empty)'}')`);

    const deadline = Date.now() + TIMEOUT_MS;
    let attempt = 0;
    for (;;) {
        attempt += 1;
        const result = evaluateGate({ sha: TAG_SHA, runs: listRuns() });
        if (result.ok) {
            console.log(`CI success confirmed for ${TAG_SHA} (run ${result.runId})`);
            return;
        }
        if (result.state === 'active' || result.state === 'no-runs' || result.state === 'no-completed') {
            if (Date.now() >= deadline) fail(`timed out after ${TIMEOUT_MS}ms waiting for green ${WORKFLOW} on ${TAG_SHA} (state=${result.state})`);
            console.log(`[${attempt}] state=${result.state} run=${result.runId ?? '-'} — waiting…`);
            await sleep(INTERVAL_MS);
            continue;
        }
        fail(`newest completed ${WORKFLOW} run on ${TAG_SHA} is ${result.conclusion} (run ${result.runId}); a failed workflow never satisfies the release gate`);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
}

/**
 * Publish preflight: registry facts must agree with the workspace package set
 * before any package is uploaded.
 *
 * A publish that dies half-way leaves npm with a partial release. This gate
 * checks, for the whole set at once:
 * - every publishable package (not `private`) declares exactly the target version;
 * - every `workspace:*` optional dependency names a package in the set;
 * - the target version is not taken on the registry for any package;
 * - when a package already has a `latest`, the target is its immediate patch
 *   successor (releases stay continuous; the first real version may be 0.0.1).
 *
 * Usage: node scripts/ci/preflight-publish.mjs --version=X.Y.Z
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function fail(msg) {
    console.error(`preflight-publish: ${msg}`);
    process.exit(1);
}

const version = process.argv.find((a) => a.startsWith('--version='))?.slice('--version='.length);
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`--version=X.Y.Z is required (got '${version ?? ''}')`);
}

function collectPackages() {
    const base = path.join(ROOT, 'packages');
    if (!fs.existsSync(base)) fail('no packages directory');
    const packages = [];
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const manifest = path.join(base, entry.name, 'package.json');
        if (!fs.existsSync(manifest)) continue;
        const json = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (json.private) continue;
        packages.push({ dir: path.join(base, entry.name), ...json });
    }
    if (packages.length === 0) fail('no publishable packages found');
    return packages;
}

const packages = collectPackages();
const names = new Set(packages.map((pkg) => pkg.name));

for (const pkg of packages) {
    if (pkg.version !== version) {
        fail(`${pkg.name} declares ${pkg.version}, expected ${version} — bump every package before tagging`);
    }
    for (const [dep, spec] of Object.entries(pkg.optionalDependencies ?? {})) {
        if (spec === 'workspace:*') {
            if (!names.has(dep)) fail(`${pkg.name} references workspace package ${dep}, which is not in the publish set`);
        }
        else if (String(spec).includes('workspace:')) {
            fail(`${pkg.name} uses ${dep}@${spec}; publish requires the plain workspace:* form`);
        }
    }
}

function npmView(args) {
    const r = spawnSync('npm', args, { encoding: 'utf8', shell: false });
    return { status: r.status ?? 1, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? '').trim() };
}

function parseSemver(v) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? '').trim());
    return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

const target = parseSemver(version);
if (!target) fail(`cannot parse ${version}`);

for (const pkg of packages) {
    const taken = npmView(['view', `${pkg.name}@${version}`, 'version', '--json']);
    if (taken.status === 0 && taken.stdout) {
        fail(`${pkg.name}@${version} already exists on the registry; publishing it again is forbidden`);
    }
    const latest = npmView(['view', pkg.name, 'version', '--json']);
    if (latest.status === 0 && latest.stdout) {
        const current = parseSemver(latest.stdout.replace(/"/g, ''));
        if (!current) fail(`cannot parse latest ${pkg.name}@${latest.stdout}`);
        const continuous = target.major === current.major && target.minor === current.minor && target.patch === current.patch + 1;
        if (!continuous) {
            fail(`${pkg.name} latest is ${current.major}.${current.minor}.${current.patch}; the next trusted patch release must be ${current.major}.${current.minor}.${current.patch + 1}, got ${version} — releases stay continuous`);
        }
    }
    console.log(`${pkg.name}: ${version} is free (latest: ${latest.status === 0 ? latest.stdout.replace(/"/g, '') : 'none'})`);
}

console.log(`preflight-publish: ${packages.length} packages ready for ${version}`);

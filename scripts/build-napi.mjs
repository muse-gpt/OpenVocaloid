/**
 * Host ↔ platform-package map for OpenVoice native sidecars.
 *
 * Every build / stage / loader path must go through this module so the
 * supported matrix stays one place. Unsupported hosts fail here instead of
 * producing a package that cannot load.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {{ platform: string, arch: string, triple: string, cdylib: string }} Target */

/** @type {Record<string, Target>} */
export const TARGETS = {
    'x86_64-pc-windows-msvc': {
        platform: 'win32',
        arch: 'x64',
        triple: 'x86_64-pc-windows-msvc',
        cdylib: 'openvoice_napi.dll',
    },
    'x86_64-unknown-linux-gnu': {
        platform: 'linux',
        arch: 'x64',
        triple: 'x86_64-unknown-linux-gnu',
        cdylib: 'libopenvoice_napi.so',
    },
    'aarch64-unknown-linux-gnu': {
        platform: 'linux',
        arch: 'arm64',
        triple: 'aarch64-unknown-linux-gnu',
        cdylib: 'libopenvoice_napi.so',
    },
    'x86_64-apple-darwin': {
        platform: 'darwin',
        arch: 'x64',
        triple: 'x86_64-apple-darwin',
        cdylib: 'libopenvoice_napi.dylib',
    },
    'aarch64-apple-darwin': {
        platform: 'darwin',
        arch: 'arm64',
        triple: 'aarch64-apple-darwin',
        cdylib: 'libopenvoice_napi.dylib',
    },
};

/** @type {Record<string, string>} */
const HOST_TO_TRIPLE = {
    'win32-x64': 'x86_64-pc-windows-msvc',
    'linux-x64': 'x86_64-unknown-linux-gnu',
    'linux-arm64': 'aarch64-unknown-linux-gnu',
    'darwin-x64': 'x86_64-apple-darwin',
    'darwin-arm64': 'aarch64-apple-darwin',
};

export function shortName(target) {
    return `${target.platform}-${target.arch}`;
}

export function packageName(target) {
    return `open-voice-${shortName(target)}`;
}

export function scopedPackageName(target) {
    return `@wae/${packageName(target)}`;
}

export function nodeFileName(target) {
    return `open-voice.${shortName(target)}.node`;
}

export function packageDir(root, target) {
    return path.join(root, 'packages', packageName(target));
}

export function usesExplicitTarget() {
    return Boolean(process.env.OPEN_VOICE_TARGET);
}

function hostTriple() {
    const host = `${process.platform}-${process.arch}`;
    const triple = HOST_TO_TRIPLE[host];
    if (!triple) {
        throw new Error(
            `Unsupported host ${host}. Supported: ${Object.keys(HOST_TO_TRIPLE).join(', ')}`,
        );
    }
    return triple;
}

/** `OPEN_VOICE_TARGET` selects an explicit Rust target triple. */
export function resolveTarget() {
    const triple = process.env.OPEN_VOICE_TARGET || hostTriple();
    const target = TARGETS[triple];
    if (!target) {
        throw new Error(
            `Unsupported Rust target ${triple}. Supported: ${Object.keys(TARGETS).join(', ')}`,
        );
    }
    return target;
}

export function releaseDir(root, target) {
    return usesExplicitTarget()
        ? path.join(root, 'target', target.triple, 'release')
        : path.join(root, 'target', 'release');
}

/** Every short platform key this repo ships. */
export function supportedShortNames() {
    return Object.values(TARGETS).map(shortName);
}

/**
 * Builds the N-API cdylib for the resolved target and stages it into the
 * matching platform package.
 *
 * `OPEN_VOICE_TARGET` selects a cross target; otherwise the host target is
 * used. A missing artifact is an error, never a silently skipped stage.
 */
export function buildAndStage(root) {
    const target = resolveTarget();
    const args = ['build', '-p', 'openvoice-napi', '--release'];
    if (usesExplicitTarget()) {
        args.push('--target', target.triple);
    }
    execFileSync('cargo', args, { cwd: root, stdio: 'inherit' });
    const artifact = path.join(releaseDir(root, target), target.cdylib);
    if (!existsSync(artifact)) {
        throw new Error(`expected ${target.cdylib} for ${target.triple} at ${artifact}`);
    }
    const dir = packageDir(root, target);
    mkdirSync(dir, { recursive: true });
    const staged = path.join(dir, nodeFileName(target));
    copyFileSync(artifact, staged);
    return staged;
}

// Executable entry: `node scripts/build-napi.mjs`. Importing this module only
// reads the matrix.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const staged = buildAndStage(root);
    console.log(`staged ${staged}`);
}

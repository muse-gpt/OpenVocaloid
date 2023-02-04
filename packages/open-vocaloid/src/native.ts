/**
 * Native binding loader for `@wae/open-vocaloid`.
 *
 * The N-API module is the only implementation path. A missing binary produces
 * an actionable error instead of silently degrading to a JS implementation.
 */
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export type PlatformKey = 'win32-x64' | 'linux-x64' | 'linux-arm64' | 'darwin-x64' | 'darwin-arm64';

export interface NativeVowelRow {
    vowel: string;
    formants: number[];
}

export interface NativeSongInfo {
    duration_seconds: number;
    syllables: number;
}

export interface NativeLevel {
    peak_dbfs: number;
    rms_dbfs: number;
    clipped: number;
    samples: number;
}

export interface NativeRenderResult extends NativeSongInfo {
    out: string;
    bytes: number;
    /** FNV-1a of the written WAV bytes. */
    fingerprint: string;
    level: NativeLevel;
}

export interface NativeWordTiming {
    startMs: number;
    endMs: number;
    text: string;
}

/** The upstream `BackendCapability` shape, as the native side serializes it. */
export interface NativeVoiceBackend {
    id: string;
    version: string;
    features: string[];
    languages?: string[];
    voices?: string[];
    rate?: boolean;
    streaming?: boolean;
    timing?: string;
    execution: { kind: string; service?: string; runtime?: string; unofficial?: boolean };
    billing: { kind: string; unit?: string };
}

export interface NativeBinding {
    version(): string;
    vowelTable(): NativeVowelRow[];
    onsetTable(): string[];
    validateSpec(options: { spec: string }): true;
    songInfo(options: { spec: string }): NativeSongInfo;
    renderSong(options: { spec: string; out: string }): NativeRenderResult;
    checkVoiceRequest(options: { backend: string; request: string }): true;
    voiceRequestFingerprint(options: { backend: string; request: string }): string;
    readaloudCapability(): NativeVoiceBackend;
    synthesizeRemote(options: {
        text: string;
        voice: string;
        ratePercent?: number;
        wordBoundaries?: boolean;
        out: string;
    }): { out: string; bytes: number; timings: NativeWordTiming[] };
    parseWordTimings(options: { srt: string }): { timings: NativeWordTiming[] };
}

/** Map Node platform and arch to the optionalDependency package suffix. */
export function platformKey(platform = process.platform, arch = process.arch): PlatformKey | null {
    if (platform === 'win32' && arch === 'x64') return 'win32-x64';
    if (platform === 'linux' && arch === 'x64') return 'linux-x64';
    if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';
    if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
    if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
    return null;
}

function candidates(key: PlatformKey): string[] {
    const override = process.env.OPEN_VOCALOID_NATIVE;
    const scoped = `@wae/open-vocaloid-${key}`;
    const here = path.dirname(fileURLToPath(import.meta.url));
    const local = path.resolve(here, '..', '..', `open-vocaloid-${key}`);
    const packages = [scoped, local];
    return override ? [override, ...packages] : packages;
}

function load(): NativeBinding {
    const key = platformKey();
    if (!key) {
        throw new Error(
            `OpenVocaloid native binding is not available for ${os.platform()}-${os.arch()}.\n` +
                `Supported hosts: win32-x64, linux-x64, linux-arm64, darwin-x64, darwin-arm64.\n` +
                `Set OPEN_VOCALOID_NATIVE to a built .node file when staging outside the optional-dep layout.`,
        );
    }
    const errors: string[] = [];
    for (const candidate of candidates(key)) {
        try {
            return require(candidate) as NativeBinding;
        }
        catch (error) {
            errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(
        `OpenVocaloid native binding is not available for ${key}.\n` +
            `Set OPEN_VOCALOID_NATIVE to a built .node file, or install @wae/open-vocaloid-${key}.\n` +
            `Tried:\n${errors.map((line) => `  - ${line}`).join('\n')}`,
    );
}

export const native = load();

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

export interface NativeBinding {
    version(): string;
    vowelTable(): NativeVowelRow[];
    onsetTable(): string[];
    validateSpec(options: { spec: string }): true;
    songInfo(options: { spec: string }): NativeSongInfo;
    renderSong(options: { spec: string; out: string }): NativeRenderResult;
}

const PLATFORM_PACKAGE = '@wae/open-vocaloid-win32-x64';

function candidates(): string[] {
    const override = process.env.OPEN_VOCALOID_NATIVE;
    const here = path.dirname(fileURLToPath(import.meta.url));
    const local = path.resolve(here, '..', '..', 'open-vocaloid-win32-x64');
    const packages = [PLATFORM_PACKAGE, local];
    return override ? [override, ...packages] : packages;
}

function load(): NativeBinding {
    const errors: string[] = [];
    for (const candidate of candidates()) {
        try {
            return require(candidate) as NativeBinding;
        }
        catch (error) {
            errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(
        `OpenVocaloid native binding is not available for ${os.platform()}-${os.arch()}.\n` +
            `Set OPEN_VOCALOID_NATIVE to a built .node file, or install ${PLATFORM_PACKAGE}.\n` +
            `Tried:\n${errors.map((line) => `  - ${line}`).join('\n')}`,
    );
}

export const native = load();

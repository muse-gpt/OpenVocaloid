import { readFileSync } from 'node:fs';

import type { VoiceSpec } from '../index.js';

/**
 * Read and JSON-parse a spec file. Malformed JSON is an actionable error, not
 * a silent fallback; domain validation stays upstream (`validateSong`).
 */
export function readSpecFile(path: string): VoiceSpec {
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    }
    catch (error) {
        throw new Error(`cannot read spec file: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        return JSON.parse(raw) as VoiceSpec;
    }
    catch {
        throw new Error(`spec file is not valid JSON: ${path}`);
    }
}

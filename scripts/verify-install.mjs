#!/usr/bin/env node
/**
 * Installed-state verification for OpenVoice.
 *
 * Loads the library through its public entry (so the loader, the optional
 * platform package and the staged `.node` are all exercised), renders the
 * shipped example into a temporary WAV and checks the container, the samples
 * and byte-for-byte reproducibility. Exit code is 0 only when every fact holds.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nativeVersion, renderSong } from '../packages/open-voice/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(path.join(tmpdir(), 'open-voice-verify-'));
const out = path.join(dir, 'demo.wav');
const repeat = path.join(dir, 'demo-repeat.wav');

let failed = false;
const check = (name, ok, detail) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`);
    failed ||= !ok;
};

try {
    check('module', path.basename(root) === 'OpenVoice', root);
    const version = nativeVersion();
    check('version', typeof version === 'string' && version.length > 0, version);

    const spec = JSON.parse(readFileSync(path.join(root, 'examples', 'demo.json'), 'utf8'));
    const result = renderSong(spec, out);
    check('render', result.bytes > 44 && result.out === out, `${result.bytes} bytes -> ${result.out}`);

    const wav = readFileSync(out);
    const riff = wav.toString('ascii', 0, 4);
    const wave = wav.toString('ascii', 8, 12);
    check('container', riff === 'RIFF' && wave === 'WAVE', `${riff}/${wave}`);

    // Sample data starts after the canonical 44-byte PCM header.
    let peak = 0;
    for (let i = 44; i + 1 < wav.length; i += 2) {
        peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
    }
    check('audible', peak > 0, `peak ${(peak / 32768).toFixed(3)} full scale`);

    const again = renderSong(spec, repeat);
    check('reproducible', result.fingerprint === again.fingerprint, result.fingerprint);
}
catch (error) {
    check('load', false, error instanceof Error ? error.message : String(error));
}
finally {
    rmSync(dir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);

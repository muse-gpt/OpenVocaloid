import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Cli } from '@wae/commander';

import { renderSong, songInfo, validateSong } from '../../index.js';
import { readSpecFile } from '../spec-file.js';

/** One post-render contract check. */
interface Check {
    name: string;
    ok: boolean;
    detail: string;
}

/**
 * Renders a spec into a temporary file and checks the delivery facts.
 *
 * The file is deleted afterwards, so this is a gate rather than an export:
 * existence, duration matching `songInfo`, syllable count, audibility and the
 * absence of clipping. Use `sing` when the WAV itself is the deliverable.
 */
export function registerVerifyCommand(cli: Cli): void {
    cli.command('verify', 'cli.cmd.verify')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const specPath = options._[0];
            if (!specPath) {
                console.error('usage: open-voice verify <spec.json>');
                return 2;
            }
            const out = join(tmpdir(), `open-voice-verify-${process.pid}.wav`);
            const repeat = join(tmpdir(), `open-voice-verify-${process.pid}-repeat.wav`);
            try {
                const spec = readSpecFile(specPath);
                validateSong(spec);
                const expected = songInfo(spec);
                const result = renderSong(spec, out);
                const again = renderSong(spec, repeat);
                const checks: Check[] = [
                    { name: 'output', ok: result.bytes > 0, detail: `${result.bytes} bytes` },
                    {
                        name: 'duration',
                        ok: Math.abs(result.durationSeconds - expected.durationSeconds) < 1e-6,
                        detail: `${result.durationSeconds.toFixed(3)}s`,
                    },
                    {
                        name: 'syllables',
                        ok: result.syllables === expected.syllables,
                        detail: `${result.syllables} syllables`,
                    },
                    {
                        name: 'level',
                        ok: result.level.samples > 0 && result.level.peakDbfs > -60,
                        detail: `peak ${result.level.peakDbfs.toFixed(1)} dBFS, rms ${result.level.rmsDbfs.toFixed(1)} dBFS`,
                    },
                    { name: 'clipping', ok: result.level.clipped === 0, detail: `${result.level.clipped} clipped samples` },
                    {
                        name: 'reproducible',
                        ok: result.fingerprint === again.fingerprint,
                        detail: result.fingerprint,
                    },
                ];
                const ok = checks.every((check) => check.ok);
                if (options.json === true) {
                    console.log(JSON.stringify({ ok, checks, result }, null, 2));
                }
                else {
                    for (const check of checks) {
                        console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${check.name}: ${check.detail}`);
                    }
                }
                return ok ? 0 : 1;
            }
            catch (error) {
                console.error(`open-voice: ${error instanceof Error ? error.message : String(error)}`);
                return 1;
            }
            finally {
                rmSync(out, { force: true });
                rmSync(repeat, { force: true });
            }
        });
}

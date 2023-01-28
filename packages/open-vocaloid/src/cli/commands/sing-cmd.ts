import type { Cli } from '@wae/commander';

import { renderSong } from '../../index.js';
import type { VoiceSpec } from '../../index.js';
import { readSpecFile } from '../spec-file.js';

export function registerSingCommand(cli: Cli): void {
    // Positional args arrive in `options._`; the rawName is the bare command
    // token (`splitNames` only knows `|` aliases).
    cli.command('sing', 'cli.cmd.sing')
        .option('-o, --output <file>', 'cli.opt.output')
        .option('--seed <n>', 'cli.opt.seed')
        .option('--volume <0..1>', 'cli.opt.volume')
        .option('--tempo <bpm>', 'cli.opt.tempo')
        .option('--breath <0..1>', 'cli.opt.breath')
        .option('--vibrato <rate,depth,delay>', 'cli.opt.vibrato')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const specPath = options._[0];
            const out = options.output as string | undefined;
            if (!specPath || !out) {
                console.error('usage: open-vocaloid sing <spec.json> --output <out.wav>');
                return 2;
            }
            try {
                const spec = applyOverrides(readSpecFile(specPath), options);
                const result = renderSong(spec, out);
                if (options.json === true) {
                    console.log(JSON.stringify(result, null, 2));
                    return 0;
                }
                console.log(`${result.out} ${result.bytes} bytes (${result.syllables} syllables, ${result.durationSeconds.toFixed(2)}s)`);
                console.log(
                    `level: peak ${result.level.peakDbfs.toFixed(1)} dBFS, rms ${result.level.rmsDbfs.toFixed(1)} dBFS` +
                        (result.level.clipped > 0 ? `, clipped ${result.level.clipped}` : ''),
                );
                console.log(`fingerprint: ${result.fingerprint}`);
                return 0;
            }
            catch (error) {
                // Domain errors carry an `invalid_input:`/`io:` prefix; print the
                // message instead of a stack trace.
                console.error(`open-vocaloid: ${error instanceof Error ? error.message : String(error)}`);
                return 1;
            }
        });
}

/** Applies CLI overrides on top of the spec; the domain still validates them. */
function applyOverrides(spec: VoiceSpec, options: Record<string, unknown>): VoiceSpec {
    const next: VoiceSpec = { ...spec };
    if (options.seed !== undefined) {
        next.seed = Number(options.seed);
    }
    if (options.volume !== undefined) {
        next.volume = Number(options.volume);
    }
    if (options.tempo !== undefined) {
        next.tempoBpm = Number(options.tempo);
    }
    if (options.breath !== undefined) {
        next.breath = Number(options.breath);
    }
    if (options.vibrato !== undefined) {
        const parts = String(options.vibrato).split(',').map(Number);
        if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
            throw new Error('--vibrato must be <rate>,<depth>,<delay>, e.g. 5.5,0.12,0.25');
        }
        next.vibrato = { rateHz: parts[0], depth: parts[1], delayS: parts[2] };
    }
    return next;
}

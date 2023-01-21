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
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const specPath = options._[0];
            const out = options.output as string | undefined;
            if (!specPath || !out) {
                console.error('usage: open-vocaloid sing <spec.json> --output <out.wav>');
                return 2;
            }
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
            return 0;
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
    return next;
}

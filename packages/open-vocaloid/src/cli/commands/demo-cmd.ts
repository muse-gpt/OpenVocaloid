import type { Cli } from '@wae/commander';

import { renderSong, type VoiceSpec } from '../../index.js';

/** The built-in demo: a rising solfa phrase (ら し ど in solfège spirit). */
export function demoSpec(): VoiceSpec {
    return {
        syllables: [
            { onset: 'r', vowel: 'a', pitch: 392.0, beats: 1.0 },
            { vowel: 'i', pitch: 440.0, beats: 1.0 },
            { onset: 'n', vowel: 'o', pitch: 523.25, beats: 2.0 },
        ],
        tempoBpm: 120,
        breath: 0.1,
        volume: 0.8,
        seed: 1,
    };
}

export function registerDemoCommand(cli: Cli): void {
    cli.command('demo', 'cli.cmd.demo')
        .option('-o, --output <file>', 'cli.opt.output')
        .action((options) => {
            const out = (options.output as string | undefined) ?? 'demo.wav';
            const result = renderSong(demoSpec(), out);
            console.log(`${result.out} ${result.bytes} bytes (${result.syllables} syllables, ${result.durationSeconds.toFixed(2)}s)`);
            return 0;
        });
}

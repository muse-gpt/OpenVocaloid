import type { Cli } from '@wae/commander';

import { renderSong } from '../../index.js';
import { readSpecFile } from '../spec-file.js';

export function registerSingCommand(cli: Cli): void {
    // Positional args arrive in `options._`; the rawName is the bare command
    // token (`splitNames` only knows `|` aliases).
    cli.command('sing', 'cli.cmd.sing')
        .option('-o, --output <file>', 'cli.opt.output')
        .action((options) => {
            const specPath = options._[0];
            const out = options.output as string | undefined;
            if (!specPath || !out) {
                console.error('usage: open-vocaloid sing <spec.json> --output <out.wav>');
                return 2;
            }
            const result = renderSong(readSpecFile(specPath), out);
            console.log(`${result.out} ${result.bytes} bytes (${result.syllables} syllables, ${result.durationSeconds.toFixed(2)}s)`);
            return 0;
        });
}

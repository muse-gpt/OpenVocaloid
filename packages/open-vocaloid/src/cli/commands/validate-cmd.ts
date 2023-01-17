import type { Cli } from '@wae/commander';

import { songInfo, validateSong } from '../../index.js';
import { readSpecFile } from '../spec-file.js';

export function registerValidateCommand(cli: Cli): void {
    cli.command('validate', 'cli.cmd.validate')
        .action((options) => {
            const specPath = options._[0];
            if (!specPath) {
                console.error('usage: open-vocaloid validate <spec.json>');
                return 2;
            }
            const spec = readSpecFile(specPath);
            validateSong(spec);
            const info = songInfo(spec);
            console.log(`ok: ${specPath} (${info.syllables} syllables, ${info.durationSeconds.toFixed(2)}s)`);
            return 0;
        });
}

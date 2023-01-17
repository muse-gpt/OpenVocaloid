import type { Cli } from '@wae/commander';

import { listOnsets, listVowels, nativeVersion } from '../../index.js';

export function registerInfoCommand(cli: Cli): void {
    cli.command('info', 'cli.cmd.info')
        .action(() => {
            console.log(`open-vocaloid ${nativeVersion()}`);
            console.log('vowels (formants F1/F2/F3 Hz):');
            for (const row of listVowels()) {
                console.log(`  ${row.vowel}: ${row.formants.join(' / ')}`);
            }
            console.log(`onsets: ${listOnsets().join(' ')}`);
            return 0;
        });
}

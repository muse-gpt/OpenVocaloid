import type { Cli } from '@wae/commander';

import { listOnsets, listVowels, nativeVersion } from '../../index.js';

export function registerInfoCommand(cli: Cli): void {
    cli.command('info', 'cli.cmd.info')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const vowels = listVowels();
            const onsets = listOnsets();
            if (options.json === true) {
                console.log(JSON.stringify({ version: nativeVersion(), vowels, onsets }, null, 2));
                return 0;
            }
            console.log(`open-voice ${nativeVersion()}`);
            console.log('vowels (formants F1/F2/F3 Hz):');
            for (const row of vowels) {
                console.log(`  ${row.vowel}: ${row.formants.join(' / ')}`);
            }
            console.log(`onsets: ${onsets.join(' ')}`);
            return 0;
        });
}

import type { Cli } from '@wae/commander';

import { nativeVersion } from '../../index.js';

/** Prints the native engine version. */
export function registerVersionCommand(cli: Cli): void {
    cli.command('version', 'cli.cmd.version')
        .option('--json', 'cli.opt.json')
        .action((options) => {
            const version = nativeVersion();
            if (options.json === true) {
                console.log(JSON.stringify({ version }, null, 2));
                return 0;
            }
            console.log(version);
            return 0;
        });
}

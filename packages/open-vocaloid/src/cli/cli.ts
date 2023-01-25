import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCli } from '@wae/commander';

import { registerDemoCommand } from './commands/demo-cmd.js';
import { registerInfoCommand } from './commands/info-cmd.js';
import { registerSingCommand } from './commands/sing-cmd.js';
import { registerValidateCommand } from './commands/validate-cmd.js';
import { registerVerifyCommand } from './commands/verify-cmd.js';
import { registerVersionCommand } from './commands/version-cmd.js';

export function localesRoot(): string {
    return join(dirname(fileURLToPath(import.meta.url)), '../../locales');
}

/** Build the `open-vocaloid` command tree (@wae/commander). */
export function buildVocaloidCli() {
    const cli = createCli('open-vocaloid')
        .locales(localesRoot(), { envKeys: ['OPEN_VOCALOID_LOCALE', 'LOCALE', 'LANG', 'LC_ALL'] })
        .intro('cli.intro');

    registerSingCommand(cli);
    registerDemoCommand(cli);
    registerValidateCommand(cli);
    registerVerifyCommand(cli);
    registerInfoCommand(cli);
    registerVersionCommand(cli);

    return cli;
}

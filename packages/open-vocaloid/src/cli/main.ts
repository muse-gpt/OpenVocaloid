#!/usr/bin/env node
import { buildVocaloidCli } from './cli.js';

const exitCode = await buildVocaloidCli().parse(process.argv.slice(2));
process.exit(exitCode);

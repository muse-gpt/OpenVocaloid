#!/usr/bin/env node
import { buildVoiceCli } from './cli.js';

const exitCode = await buildVoiceCli().parse(process.argv.slice(2));
process.exit(exitCode);

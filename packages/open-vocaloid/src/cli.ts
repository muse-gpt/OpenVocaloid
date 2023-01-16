/**
 * `open-vocaloid` CLI: sing a spec file or the built-in demo melody.
 *
 *   open-vocaloid sing ./song.json ./out/song.wav
 *   open-vocaloid demo ./out/demo.wav
 */
import { renderSong, type VoiceSpec } from './index.js';

/** The built-in demo: a rising solfa phrase (ら し ど in solfège spirit). */
function demoSpec(): VoiceSpec {
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

const [command = 'demo', ...rest] = process.argv.slice(2);

if (command === 'sing') {
    const [specPath, out] = rest;
    if (!specPath || !out) {
        console.error('usage: open-vocaloid sing <spec.json> <out.wav>');
        process.exit(1);
    }
    const { readFileSync } = await import('node:fs');
    const spec = JSON.parse(readFileSync(specPath, 'utf8')) as VoiceSpec;
    const result = renderSong(spec, out);
    console.log(`${result.out} ${result.bytes} bytes (${result.syllables} syllables, ${result.durationSeconds.toFixed(2)}s)`);
}
else if (command === 'demo') {
    const out = rest[0] ?? 'demo.wav';
    const result = renderSong(demoSpec(), out);
    console.log(`${result.out} ${result.bytes} bytes (${result.syllables} syllables, ${result.durationSeconds.toFixed(2)}s)`);
}
else {
    console.error(`unknown command: ${command}`);
    process.exit(1);
}

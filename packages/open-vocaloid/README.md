# @wae/open-vocaloid

Deterministic vocal synthesis: describe syllables and pitches, get a WAV.

```bash
npm install @wae/open-vocaloid
```

```ts
import { renderSong } from '@wae/open-vocaloid';

const result = renderSong(
    {
        syllables: [
            { onset: 'r', vowel: 'a', pitch: 392, beats: 1 },
            { vowel: 'i', pitch: 440, beats: 1 },
            { onset: 'n', vowel: 'o', pitch: 523.25, beats: 2 },
        ],
        tempoBpm: 120,
        breath: 0.1,
        volume: 0.8,
        seed: 1,
    },
    'out/song.wav',
);

console.log(result.bytes, result.level.peakDbfs, result.fingerprint);
```

The same spec and seed always produce the same samples and the same
`fingerprint` (FNV-1a of the written WAV bytes), so a delivery can be compared
without listening to it.

## Library surface

- `listVowels()` / `listOnsets()` — the contracted vowels and onset classes.
- `validateSong(spec)` — reject invalid input without rendering.
- `songInfo(spec)` — duration and syllable count only.
- `renderSong(spec, out)` — render, measure and report.

Input is rejected, never clamped: an unknown vowel or onset, an out-of-range
pitch, beat, tempo, volume or breath, and non-finite numbers all throw with an
`invalid_input:` prefix. Write failures carry `io:`.

## CLI

```bash
open-vocaloid sing   <spec.json> --output out.wav [--seed n] [--volume 0..1] [--tempo bpm]
                     [--breath 0..1] [--vibrato rate,depth,delay] [--transpose semitones] [--json]
open-vocaloid demo   --output out.wav [--json]
open-vocaloid validate <spec.json> [--json]
open-vocaloid verify   <spec.json> [--json]
open-vocaloid info
open-vocaloid version
```

`verify` renders twice and fails unless the two fingerprints match, which makes
it usable as a reproducible-asset gate in CI.

## Platform support

Prebuilt native addons ship for Windows x64, Linux x64, Linux arm64, macOS x64
and macOS arm64 through optional dependencies. Set `OPEN_VOCALOID_NATIVE` to a
built `.node` file when staging outside that layout.

## License

Apache-2.0.

# OpenVoice — vocal synthesis product

**Vocal synthesis in the broad sense, not a VOCALOID clone.** Paired with
[OpenSFX](../OpenSFX) (procedural sound effects): one synthesizes voices, the
other synthesizes effects.

## Positioning

In everyday usage "VOCALOID" became a synonym for synthesized singing, but that
is only the narrow sense — works made with that one piece of software. Electronic
singing has many technical routes: UTAU, CeVIO, Synthesizer V, NEUTRINO,
VOCALOID 6 AI, and so on. Broadly, every commercial singing-synthesis product
(including AI engines) belongs to the same field, while UTAU voice banks,
hand-made VOCALOID and AI singing-voice conversion (SVC) come from the other
lineage where people extract and splice their own material.

OpenVoice does not clone any single product; it builds an **engine-agnostic
vocal synthesis product**:

- **Input contract**: score and note durations, lyrics as syllables (onset class
  × vowel × pitch × beats), plus expression controls (vibrato, breath).
- **Pluggable engine backends**: the current delivery is formant category
  synthesis — deterministic, zero-asset, with the whole contract in Rust. Neural
  voice banks or SVC-style backends can be added after a real selection process.
- **Honest boundary**: formant synthesis is not human-level singing, and each
  backend's controls map to what that backend actually supports — parameter
  names never pretend capability.

## Usage

```bash
pnpm build
node packages/open-voice/dist/cli/main.js demo --output ./out/demo.wav
node packages/open-voice/dist/cli/main.js sing ./song.json --output ./out/song.wav
node packages/open-voice/dist/cli/main.js sing ./song.json --output ./out/song.wav --seed 2 --tempo 100 --volume 0.5
node packages/open-voice/dist/cli/main.js sing ./song.json --output ./out/song.wav --breath 0.2 --vibrato 5.5,0.12,0.25
node packages/open-voice/dist/cli/main.js validate ./song.json
node packages/open-voice/dist/cli/main.js verify ./song.json --json
node packages/open-voice/dist/cli/main.js info
node packages/open-voice/dist/cli/main.js validate ./song.json --json
node packages/open-voice/dist/cli/main.js info --json
```

As a library (small orthogonal functions):

```ts
import { renderSong, validateSong, songInfo, listVowels, listOnsets } from '@wae/open-voice';

const spec = {
    syllables: [{ onset: 'r', vowel: 'a', pitch: 392.0, beats: 1.0 }],
    tempoBpm: 120,
};
validateSong(spec);
renderSong(spec, './out/song.wav');
```

## Architecture

- The domain core lives upstream in the shared `media.*` tree: `media.voice`
  (syllable contract, formant engine, deterministic rendering) and
  `media.render` (`voice-export`: render + PCM16 quantization + WAV through
  `media.codec`).
- `--seed` / `--tempo` / `--volume` / `--breath` / `--vibrato` are explicit overrides on top of the spec;
  range validation stays in Rust (out-of-range returns `invalid_input`).
- This repository keeps only the thin binding (Node-API), the TypeScript
  authoring surface, the CLI (`@wae/commander` command tree) and the platform
  package.
- Contract: range validation in Rust (`invalid_input`, no clamping in the
  binding), byte-identical output for the same spec and seed, single kebab-case
  spelling for vowel and onset names.
- License: Apache-2.0.

# @wae/open-voice-darwin-x64

Prebuilt native artifact for macOS x64. **Not a public import target.**

Pulled automatically when installing `@wae/open-voice` on matching hosts.

## Example

```ts
import { renderSong } from '@wae/open-voice';

const result = renderSong(
    { syllables: [{ vowel: 'a', pitch: 440, beats: 1 }], tempoBpm: 120 },
    'out/demo.wav',
);
console.log(result.out, result.fingerprint);
```

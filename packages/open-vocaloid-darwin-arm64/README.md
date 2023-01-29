# @wae/open-vocaloid-darwin-arm64

Prebuilt native artifact for macOS arm64 (Apple Silicon). **Not a public import target.**

Pulled automatically when installing `@wae/open-vocaloid` on matching hosts.

## Example

```ts
import { renderSong } from '@wae/open-vocaloid';

const result = renderSong(
    { syllables: [{ vowel: 'a', pitch: 440, beats: 1 }], tempoBpm: 120 },
    'out/demo.wav',
);
console.log(result.out, result.fingerprint);
```

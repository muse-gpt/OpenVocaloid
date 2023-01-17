# OpenVocaloid — 人声合成产品

**泛指人声合成，不限于 VOCALOID 复刻。** 与 [OpenSFX](../OpenSFX)（参数化音效合成）成对：一个合成人声，一个合成音效。

## 定位

「VOCALOID」在大众语境里长期被当作“电子歌声合成”的代名词，但那只是狭义——用 VOCALOID 软件制作的作品。事实上电子歌声合成的技术路线很多：UTAU、CeVIO、Synthesizer V、NEUTRINO、VOCALOID 6 AI……广义上，凡是商业歌声合成软件（含 AI 引擎）制作的作品都属于同一领域；而 UTAU 声库、人力 VOCALOID、AI 语音转换（SVC）则来自“自行提取素材”的另一条脉络。

OpenVocaloid 不复刻任何单一软件，而是建设**引擎无关的人声合成产品**：

- **输入合同**：乐谱/音符时值、歌词（音节：辅音类 × 元音 × 音高 × 时值）、音高与表现控制（vibrato、breath）。
- **引擎后端（可插拔）**：当前交付的是共鸣峰（formant）类别合成——确定性、零素材依赖、合同全在 Rust；后续按真实选型接入神经声库或 SVC 类后端。
- **诚实边界**：formant 合成 ≠ 真人级歌声；每个后端的控制参数逐项关联其真实支持范围，禁止用参数名伪装能力。

## 使用

```bash
pnpm build
node packages/open-vocaloid/dist/cli/main.js demo --output ./out/demo.wav
node packages/open-vocaloid/dist/cli/main.js sing ./song.json --output ./out/song.wav
node packages/open-vocaloid/dist/cli/main.js validate ./song.json
node packages/open-vocaloid/dist/cli/main.js info
```

作为库（正交小函数）：

```ts
import { renderSong, validateSong, songInfo, listVowels, listOnsets } from '@wae/open-vocaloid';

const spec = {
    syllables: [{ onset: 'r', vowel: 'a', pitch: 392.0, beats: 1.0 }],
    tempoBpm: 120,
};
validateSong(spec);
renderSong(spec, './out/song.wav');
```

## 架构

- 领域核心在共享上游 `media.rs` 的 `media.voice`（音节合同、共振峰引擎、确定性渲染）与 `media.render`（`voice-export`：渲染 + PCM16 量化 + `media.codec` 写 WAV）。
- 本仓只保留薄绑定（Node-API）、TS 作者面、CLI（`@wae/commander` 命令树）与平台包。
- 合同：范围校验在 Rust（`invalid_input`，禁止绑定层钳制）；同 spec+seed 字节级复现；元音/辅音名 kebab-case 唯一拼写。
- 许可证：Apache-2.0。

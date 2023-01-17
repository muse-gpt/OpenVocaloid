/**
 * `@wae/open-vocaloid` — vocal synthesis as a library first, CLI second.
 *
 * A song is data: syllables with an onset consonant, a vowel, a pitch and a
 * duration. The same spec and seed always render the same samples. All
 * synthesis, range validation and file encoding run in the native library
 * (the upstream `media.voice` core); this module only types and forwards.
 *
 * The exports are orthogonal small functions: inspect the contract
 * ([`listVowels`] / [`listOnsets`]), check a spec without rendering
 * ([`validateSong`] / [`songInfo`]), and render ([`renderSong`]).
 */
import { native } from './native.js';

/** The five cardinal vowels of the first contract. */
export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';

/**
 * Syllable-onset consonant classes: the audible event (fricative, plosive,
 * nasal, glide), not an IPA inventory.
 */
export type Onset = 's' | 't' | 'n' | 'r' | 'w' | 'y' | 'f';

export interface Syllable {
    /** Onset consonant class; omit to sing the vowel alone. */
    onset?: Onset;
    /** The vowel the syllable settles on. */
    vowel: Vowel;
    /** Fundamental frequency in Hz, 40..1200. */
    pitch: number;
    /** Duration in beats at the song tempo, 0.05..8. */
    beats: number;
}

export interface VoiceSpec {
    /** The lyric: an ordered list of syllables; at least one. */
    syllables: Syllable[];
    /** Tempo in beats per minute, 20..400. */
    tempoBpm: number;
    /** Sustained-vowel vibrato. */
    vibrato?: {
        /** Rate in Hz, 0..10. */
        rateHz: number;
        /** Depth as a fraction of the carrier, 0..0.3. */
        depth: number;
        /** Seconds before full depth, 0..2. */
        delayS: number;
    };
    /** Breath noise mixed into the voiced source, 0..1 (default 0.08). */
    breath?: number;
    /** Overall gain, 0..1 (default 0.8). */
    volume?: number;
    /** Random seed for the breath stream (default 1). */
    seed?: number;
}

/** One vowel with its formant centres (F1, F2, F3) in Hz. */
export interface VowelInfo {
    vowel: Vowel;
    formants: [number, number, number];
}

export interface SongInfo {
    durationSeconds: number;
    syllables: number;
}

export interface RenderedSong extends SongInfo {
    out: string;
    bytes: number;
}

/** The contracted vowels with formant tables, in canonical order. */
export function listVowels(): VowelInfo[] {
    return native.vowelTable().map((row) => ({
        vowel: row.vowel as Vowel,
        formants: row.formants as [number, number, number],
    }));
}

/** The contracted onset consonant classes, in canonical order. */
export function listOnsets(): Onset[] {
    return native.onsetTable() as Onset[];
}

/**
 * Validates a spec without rendering.
 *
 * Invalid input is rejected, never clamped: an empty lyric, an unknown vowel
 * or onset, an out-of-range pitch/beats/tempo/volume/breath or a non-finite
 * number throws with an `invalid_input:`-prefixed error.
 */
export function validateSong(spec: VoiceSpec): true {
    return native.validateSpec({ spec: JSON.stringify(spec) });
}

/** Derives duration and syllable count from a spec without rendering. */
export function songInfo(spec: VoiceSpec): SongInfo {
    const info = native.songInfo({ spec: JSON.stringify(spec) });
    return { durationSeconds: info.duration_seconds, syllables: info.syllables };
}

/**
 * Renders a song spec into a WAV at `out`.
 *
 * Throws on invalid input exactly like [`validateSong`]; output directory and
 * write failures carry an `io:`-prefixed error.
 */
export function renderSong(spec: VoiceSpec, out: string): RenderedSong {
    const result = native.renderSong({ spec: JSON.stringify(spec), out });
    return {
        out: result.out,
        bytes: result.bytes,
        durationSeconds: result.duration_seconds,
        syllables: result.syllables,
    };
}

/** Native library version, used by hosts to verify the binary. */
export function nativeVersion(): string {
    return native.version();
}

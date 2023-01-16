/**
 * `@wae/open-vocaloid` — describe a song with a spec, get a sung WAV.
 *
 * A song is data: syllables with an onset consonant, a vowel, a pitch and a
 * duration. The same spec and seed always render the same samples. All
 * synthesis, range validation and file encoding run in the native library
 * (the upstream `media.voice` core); this module only types and forwards.
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

export interface RenderedSong {
    out: string;
    bytes: number;
    durationSeconds: number;
    syllables: number;
}

/**
 * Renders a song spec into a WAV at `out`.
 *
 * Invalid input is rejected, never clamped: an empty lyric, an unknown vowel
 * or onset, an out-of-range pitch/beats/tempo/volume/breath or a non-finite
 * number throws with an `invalid_input:`-prefixed error.
 */
export function renderSong(spec: VoiceSpec, out: string): RenderedSong {
    const result = native.renderSong({ spec: JSON.stringify(spec), out });
    // The native layer speaks snake_case; the author face stays camelCase.
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

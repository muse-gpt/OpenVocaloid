//! Node-API surface for OpenVocaloid.
//!
//! Orthogonal small exports — one function per capability, library first:
//! - [`version`]: binary version for host verification.
//! - [`vowel_table`] / [`onset_table`]: the contract's capability tables,
//!   read from the single upstream source (`media.voice`), never hand-copied.
//! - [`validate_spec`]: check a spec without rendering.
//! - [`song_info`]: derive duration/syllable count without rendering.
//! - [`render_song`]: render a spec to a WAV file.
//!
//! This layer only maps JS values onto the upstream entries: serde
//! deserialization of [`media_voice::VoiceSpec`] and the scene-free
//! `media.render` voice export (render → PCM16 quantize → `media.codec`
//! write). Every domain rule — vowel/onset resolution, the range contract,
//! vibrato/breath bounds, the seed default and the project sample rate —
//! lives upstream; nothing here re-implements, clamps or swallows them.

#![deny(missing_docs)]

use media_types::SAMPLE_RATE;
use media_voice::{Onset, VoiceSpec, Vowel};
use wae::{CallContext, Env, Error, JsValue, Result, function, register_module};

/// Library version used by `@wae/open-vocaloid` to verify the native binary.
#[function]
fn version(ctx: CallContext) -> Result<JsValue> {
    ctx.env().string(env!("CARGO_PKG_VERSION"))
}

/// The contracted vowels with their formant tables, in canonical order.
#[function(js_name = "vowelTable")]
fn vowel_table(ctx: CallContext) -> Result<JsValue> {
    let rows: Vec<serde_json::Value> = Vowel::ALL
        .iter()
        .map(|vowel| serde_json::json!({ "vowel": vowel.as_str(), "formants": vowel.formants() }))
        .collect();
    json_to_js(ctx.env(), &serde_json::Value::Array(rows))
}

/// The contracted onset consonant classes, in canonical order.
#[function(js_name = "onsetTable")]
fn onset_table(ctx: CallContext) -> Result<JsValue> {
    let names: Vec<serde_json::Value> = Onset::ALL
        .iter()
        .map(|onset| serde_json::Value::String(onset.as_str().to_owned()))
        .collect();
    json_to_js(ctx.env(), &serde_json::Value::Array(names))
}

/// Validates a spec without rendering. Returns `{ ok: true }` or throws with
/// the stable `invalid_input:` prefix.
#[function(js_name = "validateSpec")]
fn validate_spec(ctx: CallContext) -> Result<JsValue> {
    let spec = read_spec(&ctx)?;
    spec.validate().map_err(map_domain_error)?;
    ctx.env().boolean(true)
}

/// Derives duration and syllable count from a spec without rendering.
#[function(js_name = "songInfo")]
fn song_info(ctx: CallContext) -> Result<JsValue> {
    let spec = read_spec(&ctx)?;
    spec.validate().map_err(map_domain_error)?;
    let value = serde_json::json!({
        "duration_seconds": spec.duration_seconds(),
        "syllables": spec.syllables.len(),
    });
    json_to_js(ctx.env(), &value)
}

/// Renders a song spec into a WAV file.
///
/// Argument: `{ out: string, spec: string }` — the spec is JSON in the
/// JS authoring shape (lowercase `vowel`/`onset` names, camelCase keys,
/// `seed` defaulting to 1) and is mapped to the domain's snake_case fields
/// by this binding. An empty lyric, an unknown vowel or onset, an
/// out-of-range pitch/beats/tempo/volume/breath and non-finite values reject
/// with the stable `invalid_input:` prefix; output directory and write
/// failures keep their `io:` code. The sample rate is the project default
/// from `media.types`, passed explicitly — hosts cannot pick another rate
/// through this binding.
#[function(js_name = "renderSong")]
fn render_song(ctx: CallContext) -> Result<JsValue> {
    let spec = read_spec(&ctx)?;
    let out = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("renderSong requires an options object"))?
        .get_named("out")?
        .as_string()?;

    if let Some(parent) = std::path::Path::new(&out).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| Error::new(format!("cannot create output directory: {e}")))?;
        }
    }

    // One synthesis pass feeds both the file and the meter: the host gets
    // level facts without rendering the song twice.
    let frames = media_render::voice_samples(&spec, SAMPLE_RATE).map_err(map_domain_error)?;
    media_render::write_voice_frames(&frames, &out, SAMPLE_RATE).map_err(map_domain_error)?;
    let interleaved: Vec<f32> = frames.iter().flat_map(|frame| frame.iter().copied()).collect();
    let level = media_harness::measure_f32(&interleaved);

    // The fingerprint covers the bytes on disk, so two hosts can prove they
    // produced the same asset without comparing waveforms.
    let written = std::fs::read(&out).map_err(|e| Error::new(format!("cannot read back {out}: {e}")))?;
    let bytes = written.len() as u64;
    let value = serde_json::json!({
        "out": out,
        "bytes": bytes,
        "duration_seconds": spec.duration_seconds(),
        "syllables": spec.syllables.len(),
        "fingerprint": fnv1a(&written),
        "level": {
            "peak_dbfs": level.peak_db,
            "rms_dbfs": level.rms_db,
            "clipped": level.clipped,
            "samples": level.samples,
        },
    });
    json_to_js(ctx.env(), &value)
}

/// Checks a backend declaration against a request without running anything.
///
/// Argument: `{ backend: string, request: string }`, both JSON in the JS
/// authoring shape. An undeclared feature, language, voice, rate, streaming or
/// timing request is rejected with the backend's name and an `unsupported_platform:`
/// prefix. Nothing is substituted: a caller that wants another backend has to
/// ask for it explicitly.
#[function(js_name = "checkVoiceRequest")]
fn check_voice_request(ctx: CallContext) -> Result<JsValue> {
    let (backend, request) = read_backend_request(&ctx)?;
    media_voice::check_request(&backend, &request).map_err(map_domain_error)?;
    ctx.env().boolean(true)
}

/// Fingerprint of everything that changes the produced audio.
///
/// Argument: `{ backend: string, request: string }`. The backend id and version
/// are part of the value, so upgrading the engine invalidates cached audio even
/// when the request text is unchanged.
#[function(js_name = "voiceRequestFingerprint")]
fn voice_request_fingerprint(ctx: CallContext) -> Result<JsValue> {
    let (backend, request) = read_backend_request(&ctx)?;
    let fingerprint = media_voice::request_fingerprint(&backend, &request);
    ctx.env().string(&fingerprint)
}

/// Parses the word-boundary SRT an engine reports into timings.
///
/// Argument: `{ srt: string }`. Returns `{ timings: [{ startMs, endMs, text }] }`.
/// A malformed or backwards cue is an error: a dropped word would look like a
/// successful alignment.
#[function(js_name = "parseWordTimings")]
fn parse_word_timings(ctx: CallContext) -> Result<JsValue> {
    let arg = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("parseWordTimings requires an options object"))?;
    let srt = arg.get_named("srt")?.as_string()?;
    let timings = media_voice::parse_word_srt(&srt).map_err(map_domain_error)?;
    let values: Vec<serde_json::Value> = timings
        .iter()
        .map(|timing| serde_json::json!({ "startMs": timing.start_ms, "endMs": timing.end_ms, "text": timing.text }))
        .collect();
    json_to_js(ctx.env(), &serde_json::json!({ "timings": values }))
}

/// The backend declaration the native readaloud client implements.
///
/// Returns the capability JSON directly: it is the declaration to pass to
/// `checkVoiceRequest` and `voiceRequestFingerprint`, so the author surface
/// never hand-writes the remote service's identity.
#[function(js_name = "readaloudCapability")]
fn readaloud_capability(ctx: CallContext) -> Result<JsValue> {
    let value = serde_json::to_value(media_voice::readaloud::capability()).map_err(|e| Error::new(format!("capability: {e}")))?;
    json_to_js(ctx.env(), &value)
}

/// Synthesizes speech through the Edge readaloud service, in native Rust.
///
/// Argument: `{ text, voice, ratePercent?, wordBoundaries?, out }`. The
/// request goes out over the workspace WebSocket stack and the returned MP3
/// is written to `out`; word or sentence boundaries come back in absolute
/// stream time. A refused token is retried once with the server's clock.
/// No Python and no external binary are involved.
#[function(js_name = "synthesizeRemote")]
fn synthesize_remote(ctx: CallContext) -> Result<JsValue> {
    let arg = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("synthesizeRemote requires an options object"))?;
    let text = arg.get_named("text")?.as_string()?;
    let voice = arg.get_named("voice")?.as_string()?;
    let rate = arg.get_named("ratePercent")?.as_f64().unwrap_or(0.0) as i32;
    let word_boundaries = arg.get_named("wordBoundaries")?.as_bool().unwrap_or(true);
    let out = arg.get_named("out")?.as_string()?;

    let request = media_voice::readaloud::SynthesisRequest { text, voice, rate_percent: rate, word_boundaries };
    let synthesis = media_voice::readaloud::synthesize(&request).map_err(map_domain_error)?;

    if let Some(parent) = std::path::Path::new(&out).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| Error::new(format!("cannot create output directory: {e}")))?;
        }
    }
    std::fs::write(&out, &synthesis.mp3).map_err(|e| Error::new(format!("cannot write {out}: {e}")))?;
    let timings: Vec<serde_json::Value> = synthesis
        .timings
        .iter()
        .map(|timing| serde_json::json!({ "startMs": timing.start_ms, "endMs": timing.end_ms, "text": timing.text }))
        .collect();
    json_to_js(
        ctx.env(),
        &serde_json::json!({ "out": out, "bytes": synthesis.mp3.len(), "timings": timings }),
    )
}

/// Reads the `{ backend, request }` pair with the upstream serde shapes.
fn read_backend_request(ctx: &CallContext) -> Result<(media_voice::BackendCapability, media_voice::VoiceRequest)> {
    let arg = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("a backend and request JSON are required"))?;
    let backend = parse_backend(arg.get_named("backend")?.as_string()?)?;
    let request = parse_request(arg.get_named("request")?.as_string()?)?;
    Ok((backend, request))
}

fn parse_backend(json: String) -> Result<media_voice::BackendCapability> {
    let value: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("backend: {e}"))))?;
    serde_json::from_value(snake_keys(value))
        .map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("backend: {e}"))))
}

fn parse_request(json: String) -> Result<media_voice::VoiceRequest> {
    let value: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("request: {e}"))))?;
    serde_json::from_value(snake_keys(value))
        .map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("request: {e}"))))
}

/// FNV-1a 64 of the written file, in the same `016x` form as the other hashes.
fn fnv1a(bytes: &[u8]) -> String {
    let mut state = 0xcbf2_9ce4_8422_2325u64;
    for byte in bytes {
        state ^= u64::from(*byte);
        state = state.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{state:016x}")
}

/// Reads the `{ spec: string }` option object and deserializes it with the
/// upstream serde shape. The spec arrives in JS style (camelCase) and is
/// mapped to the domain's snake_case fields here — `media.voice` keeps Rust
/// native names for every other language binding. Unknown vowels/onsets and
/// malformed JSON reject explicitly; no fallback.
fn read_spec(ctx: &CallContext) -> Result<VoiceSpec> {
    let arg = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("a spec JSON is required"))?;
    let spec_json = arg.get_named("spec")?.as_string()?;
    let value: serde_json::Value = serde_json::from_str(&spec_json)
        .map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("spec: {e}"))))?;
    serde_json::from_value::<VoiceSpec>(snake_keys(value))
        .map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("spec: {e}"))))
}

/// Recursively maps JS-style camelCase keys to the domain's snake_case keys.
fn snake_keys(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => serde_json::Value::Object(
            map.into_iter().map(|(key, inner)| (camel_to_snake(&key), snake_keys(inner))).collect(),
        ),
        serde_json::Value::Array(items) => serde_json::Value::Array(items.into_iter().map(snake_keys).collect()),
        other => other,
    }
}

fn camel_to_snake(key: &str) -> String {
    let mut out = String::with_capacity(key.len() + 4);
    for letter in key.chars() {
        if letter.is_ascii_uppercase() {
            out.push('_');
            out.push(letter.to_ascii_lowercase());
        } else {
            out.push(letter);
        }
    }
    out
}

/// Maps a `media.types` domain error onto a host error, keeping the stable
/// code (`invalid_input`, `io`, …) as the message prefix so JS callers can
/// attribute failures without parsing prose.
fn map_domain_error(error: media_types::Error) -> Error {
    Error::new(format!("{}: {error}", error.code()))
}

fn json_to_js(env: Env, value: &serde_json::Value) -> Result<JsValue> {
    match value {
        serde_json::Value::Null => env.null(),
        serde_json::Value::Bool(inner) => env.boolean(*inner),
        serde_json::Value::Number(number) => {
            if let Some(integer) = number.as_i64() {
                env.int64(integer)
            } else {
                env.double(number.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(text) => env.string(text),
        serde_json::Value::Array(items) => {
            let array = env.array_with_length(items.len())?;
            for (index, item) in items.iter().enumerate() {
                array.set_element(index as u32, json_to_js(env, item)?)?;
            }
            Ok(array)
        }
        serde_json::Value::Object(map) => {
            let object = env.object()?;
            for (key, item) in map {
                object.set_named(key, json_to_js(env, item)?)?;
            }
            Ok(object)
        }
    }
}

register_module![
    version,
    vowel_table,
    onset_table,
    validate_spec,
    song_info,
    render_song,
    check_voice_request,
    voice_request_fingerprint,
    readaloud_capability,
    synthesize_remote,
    parse_word_timings
];

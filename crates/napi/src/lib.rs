//! Node-API surface for OpenVocaloid.
//!
//! Thin binding only: the host sends a [`media_voice::VoiceSpec`] as JSON,
//! this layer deserializes it with serde and hands it to the scene-free
//! `media.render` voice export entry, which renders, quantizes to PCM16 and
//! writes the WAV through `media.codec`. Every domain rule — vowel/onset name
//! resolution, the range contract, vibrato/breath bounds, the seed default and
//! the project sample rate — lives upstream; nothing here re-implements,
//! clamps or swallows them.

#![deny(missing_docs)]

use media_types::SAMPLE_RATE;
use media_voice::VoiceSpec;
use wae::{CallContext, Env, Error, JsValue, Result, function, register_module};

/// Library version used by `@wae/open-vocaloid` to verify the native binary.
#[function]
fn version(ctx: CallContext) -> Result<JsValue> {
    ctx.env().string(env!("CARGO_PKG_VERSION"))
}

/// Renders a song spec into a WAV file.
///
/// Argument: `{ out: string, spec: string }` — the spec is JSON in the
/// `media.voice` shape (lowercase `vowel`/`onset` names, camelCase fields,
/// `seed` defaulting to 1). An empty lyric, an unknown vowel or onset, an
/// out-of-range pitch/beats/tempo/volume/breath and non-finite values reject
/// with the stable `invalid_input:` prefix; output directory and write
/// failures keep their `io:` code. The sample rate is the project default
/// from `media.types`, passed explicitly — hosts cannot pick another rate
/// through this binding.
#[function(js_name = "renderSong")]
fn render_song(ctx: CallContext) -> Result<JsValue> {
    let arg = ctx
        .args()
        .first()
        .copied()
        .ok_or_else(|| Error::new("renderSong requires an options object"))?;
    let out = arg.get_named("out")?.as_string()?;
    let spec_json = arg.get_named("spec")?.as_string()?;
    let spec: VoiceSpec = serde_json::from_str(&spec_json)
        .map_err(|e| map_domain_error(media_types::Error::invalid_input(format!("spec: {e}"))))?;

    if let Some(parent) = std::path::Path::new(&out).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| Error::new(format!("cannot create output directory: {e}")))?;
        }
    }

    media_render::write_voice(&spec, &out, SAMPLE_RATE).map_err(map_domain_error)?;

    let bytes = std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
    let value = serde_json::json!({
        "out": out,
        "bytes": bytes,
        "duration_seconds": spec.duration_seconds(),
        "syllables": spec.syllables.len(),
    });
    json_to_js(ctx.env(), &value)
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

register_module![version, render_song];

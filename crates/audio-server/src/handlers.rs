use std::{collections::HashMap, convert::TryFrom, io::Cursor};

use anyhow::{Context, anyhow};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use bytes::Bytes;
use hls_m3u8::{
    MasterPlaylist, MediaPlaylist,
    tags::VariantStream,
    types::{ByteRange, MediaType},
};
use reqwest::Client;
use serde::Deserialize;
use symphonia::core::{
    audio::SampleBuffer,
    codecs::{CODEC_TYPE_NULL, DecoderOptions},
    errors::Error as SymphoniaError,
    formats::FormatOptions,
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
};
use tokio::task::spawn_blocking;
use tracing::warn;
use url::Url;

use crate::state::AppState;

const MAX_DURATION_SECONDS: f64 = 30.0;
const MAX_SEGMENTS: usize = 128;

#[derive(Deserialize)]
pub struct AudioClipQuery {
    pub animeId: i64,
    pub episodeIndex: i64,
    pub videoIndex: i64,
    pub start: f64,
    pub end: f64,
}

#[derive(Clone)]
struct SegmentSelection {
    url: Url,
    byte_range: Option<ResolvedByteRange>,
    start_time: f64,
    map: Option<MapSelection>,
    encrypted: bool,
}

#[derive(Clone)]
struct MapSelection {
    url: Url,
    byte_range: Option<ResolvedByteRange>,
}

#[derive(Clone, Copy)]
struct ResolvedByteRange {
    start: usize,
    end: usize,
}

struct DecodedSamples {
    samples: Vec<i16>,
    sample_rate: u32,
    channels: usize,
}

struct PreparedAudio {
    data: Vec<u8>,
    hint_extension: Option<String>,
    first_pts: Option<f64>,
    force_segment_start: bool,
}

struct AdtsExtraction {
    data: Vec<u8>,
    first_pts: Option<f64>,
    force_segment_start: bool,
}

struct PesPayload {
    pts: Option<u64>,
    data: Vec<u8>,
}

pub async fn clip_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AudioClipQuery>,
) -> Response {
    let AudioClipQuery {
        animeId,
        episodeIndex,
        videoIndex,
        start,
        end,
    } = query;
    if animeId < 0 || episodeIndex < 0 || videoIndex < 0 {
        return (StatusCode::BAD_REQUEST, "Invalid ids").into_response();
    }
    if !start.is_finite() || !end.is_finite() {
        return (StatusCode::BAD_REQUEST, "Invalid range").into_response();
    }
    let safe_start = start.max(0.0);
    let safe_end = end.max(0.0);
    let duration = (safe_end - safe_start).min(MAX_DURATION_SECONDS);
    if duration <= 0.0 {
        return (StatusCode::BAD_REQUEST, "Invalid range").into_response();
    }

    let result = build_audio_clip(
        &state,
        &headers,
        animeId,
        episodeIndex,
        videoIndex,
        safe_start,
        duration,
    )
    .await;
    match result {
        Ok(bytes) => (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "audio/wav")],
            Bytes::from(bytes),
        )
            .into_response(),
        Err(err) => {
            warn!("Audio clip failed: {err}");
            (StatusCode::INTERNAL_SERVER_ERROR, "Audio clip failed").into_response()
        }
    }
}

async fn build_audio_clip(
    state: &AppState,
    headers: &HeaderMap,
    anime_id: i64,
    episode_index: i64,
    video_index: i64,
    start: f64,
    duration: f64,
) -> anyhow::Result<Vec<u8>> {
    let target_end = start + duration;
    let playlist_url = format!(
        "{}/api/v1/anime/{}/episode/{}/video/{}/playlist",
        state.suwayomi_base_url, anime_id, episode_index, video_index
    );
    let playlist_url = Url::parse(&playlist_url).context("Invalid playlist URL")?;
    let client = Client::new();
    let (playlist, base_url) = fetch_media_playlist(&client, headers, playlist_url).await?;
    let segments = select_segments(&playlist, &base_url, start, target_end)?;
    if segments.is_empty() {
        return Err(anyhow!("No matching segments found"));
    }

    let mut map_cache: HashMap<String, Vec<u8>> = HashMap::new();
    let mut output_samples: Vec<i16> = Vec::new();
    let mut output_rate: Option<u32> = None;
    let mut output_channels: Option<usize> = None;

    for segment in segments {
        if segment.encrypted {
            return Err(anyhow!("Encrypted HLS segments are not supported"));
        }
        let segment_bytes = fetch_segment_bytes(&client, headers, &segment, &mut map_cache).await?;
        let hint_extension = hint_extension_from_url(&segment.url);
        let prepared = prepare_segment_audio(segment_bytes, hint_extension);
        let base_time = if prepared.force_segment_start {
            None
        } else {
            prepared.first_pts
        };
        let segment_start = segment.start_time;
        let decoded = spawn_blocking(move || {
            decode_segment_samples(
                prepared.data,
                segment_start,
                start,
                target_end,
                prepared.hint_extension,
                base_time,
            )
        })
        .await
        .map_err(|err| anyhow!("Audio decode task failed: {err}"))??;

        let Some(decoded) = decoded else {
            continue;
        };

        if output_rate.is_none() {
            output_rate = Some(decoded.sample_rate);
            output_channels = Some(decoded.channels);
        } else if output_rate != Some(decoded.sample_rate)
            || output_channels != Some(decoded.channels)
        {
            return Err(anyhow!("Mismatched audio formats across segments"));
        }

        output_samples.extend_from_slice(&decoded.samples);
    }

    let Some(sample_rate) = output_rate else {
        return Err(anyhow!("No audio decoded"));
    };
    let channels = output_channels.unwrap_or(1);
    if output_samples.is_empty() {
        return Err(anyhow!("No audio decoded"));
    }

    encode_wav_i16(&output_samples, sample_rate, channels as u16)
}

async fn fetch_media_playlist(
    client: &Client,
    headers: &HeaderMap,
    playlist_url: Url,
) -> anyhow::Result<(MediaPlaylist<'static>, Url)> {
    let playlist_text = fetch_text(client, headers, &playlist_url).await?;
    if let Ok(media_playlist) = MediaPlaylist::try_from(playlist_text.as_str()) {
        return Ok((media_playlist.into_owned(), playlist_url));
    }

    let master_playlist = MasterPlaylist::try_from(playlist_text.as_str())
        .context("Failed to parse master playlist")?
        .into_owned();
    let variant_url = select_master_variant(&master_playlist, &playlist_url)?;
    let variant_text = fetch_text(client, headers, &variant_url).await?;
    let media_playlist = MediaPlaylist::try_from(variant_text.as_str())
        .context("Failed to parse media playlist")?
        .into_owned();
    Ok((media_playlist, variant_url))
}

fn select_master_variant(master: &MasterPlaylist<'static>, base_url: &Url) -> anyhow::Result<Url> {
    if let Some(media) = master.media.iter().find(|media| {
        media.media_type == MediaType::Audio && media.is_default && media.uri().is_some()
    }) {
        return resolve_url(base_url, media.uri().unwrap().as_ref());
    }

    if let Some(media) = master
        .media
        .iter()
        .find(|media| media.media_type == MediaType::Audio && media.uri().is_some())
    {
        return resolve_url(base_url, media.uri().unwrap().as_ref());
    }

    let mut best: Option<(&str, u64)> = None;
    for stream in &master.variant_streams {
        if let VariantStream::ExtXStreamInf {
            uri, stream_data, ..
        } = stream
        {
            let bandwidth = stream_data.bandwidth();
            if best.map_or(true, |(_, best_bw)| bandwidth < best_bw) {
                best = Some((uri.as_ref(), bandwidth));
            }
        }
    }

    let Some((uri, _)) = best else {
        return Err(anyhow!("No media playlists found in master playlist"));
    };
    resolve_url(base_url, uri)
}

fn select_segments(
    playlist: &MediaPlaylist<'static>,
    base_url: &Url,
    start: f64,
    end: f64,
) -> anyhow::Result<Vec<SegmentSelection>> {
    let mut selections = Vec::new();
    let mut time_cursor = 0.0;
    let mut last_map: Option<MapSelection> = None;
    let mut last_byte_range_end: Option<usize> = None;
    let mut previous_segment: Option<SegmentSelection> = None;

    for (_, segment) in playlist.segments.iter() {
        if let Some(map) = &segment.map {
            let map_url = resolve_url(base_url, map.uri().as_ref())?;
            let map_range = map.range().map(resolve_range_from_byte_range);
            last_map = Some(MapSelection {
                url: map_url,
                byte_range: map_range,
            });
        }

        let duration = segment.duration.duration().as_secs_f64();
        let seg_start = time_cursor;
        let seg_end = seg_start + duration;

        let byte_range = segment
            .byte_range
            .map(|range| resolve_range_from_ext_byte_range(range, &mut last_byte_range_end));
        if segment.byte_range.is_none() {
            last_byte_range_end = None;
        }

        let encrypted = segment.keys.iter().any(|key| key.is_some());
        let selection = SegmentSelection {
            url: resolve_url(base_url, segment.uri().as_ref())?,
            byte_range,
            start_time: seg_start,
            map: last_map.clone(),
            encrypted,
        };

        if seg_end >= start && seg_start <= end {
            if selections.is_empty() {
                if let Some(prev) = previous_segment.take() {
                    selections.push(prev);
                }
            }
            selections.push(selection.clone());
            if selections.len() >= MAX_SEGMENTS {
                break;
            }
        }

        previous_segment = Some(selection);

        time_cursor = seg_end;
        if time_cursor > end {
            break;
        }
    }

    Ok(selections)
}

fn resolve_range_from_ext_byte_range(
    range: hls_m3u8::tags::ExtXByteRange,
    last_end: &mut Option<usize>,
) -> ResolvedByteRange {
    let start = range.start().or(*last_end).unwrap_or(0);
    let end = range.end();
    *last_end = Some(end);
    ResolvedByteRange { start, end }
}

fn resolve_range_from_byte_range(range: ByteRange) -> ResolvedByteRange {
    let start = range.start().unwrap_or(0);
    let end = range.end();
    ResolvedByteRange { start, end }
}

async fn fetch_segment_bytes(
    client: &Client,
    headers: &HeaderMap,
    segment: &SegmentSelection,
    map_cache: &mut HashMap<String, Vec<u8>>,
) -> anyhow::Result<Vec<u8>> {
    let mut data = Vec::new();
    if let Some(map) = &segment.map {
        let cache_key = map_cache_key(&map.url, map.byte_range);
        if let Some(cached) = map_cache.get(&cache_key) {
            data.extend_from_slice(cached);
        } else {
            let bytes = fetch_bytes(client, headers, &map.url, map.byte_range).await?;
            data.extend_from_slice(&bytes);
            map_cache.insert(cache_key, bytes);
        }
    }

    let segment_bytes = fetch_bytes(client, headers, &segment.url, segment.byte_range).await?;
    data.extend_from_slice(&segment_bytes);
    Ok(data)
}

async fn fetch_text(client: &Client, headers: &HeaderMap, url: &Url) -> anyhow::Result<String> {
    let response = apply_forward_headers(client.get(url.clone()), headers)
        .send()
        .await
        .context("Playlist request failed")?
        .error_for_status()
        .context("Playlist request returned error status")?;
    response.text().await.context("Failed to read playlist")
}

async fn fetch_bytes(
    client: &Client,
    headers: &HeaderMap,
    url: &Url,
    range: Option<ResolvedByteRange>,
) -> anyhow::Result<Vec<u8>> {
    let mut request = apply_forward_headers(client.get(url.clone()), headers);
    if let Some(range) = range {
        if range.end <= range.start {
            return Err(anyhow!("Invalid byte range"));
        }
        let end_inclusive = range.end.saturating_sub(1);
        let header_value = format!("bytes={}-{}", range.start, end_inclusive);
        request = request.header("Range", header_value);
    }
    let response = request
        .send()
        .await
        .context("Segment request failed")?
        .error_for_status()
        .context("Segment request returned error status")?;
    let bytes = response.bytes().await.context("Failed to read segment")?;
    Ok(bytes.to_vec())
}

fn apply_forward_headers(
    mut request: reqwest::RequestBuilder,
    headers: &HeaderMap,
) -> reqwest::RequestBuilder {
    if let Some(value) = headers.get(axum::http::header::COOKIE) {
        request = request.header(axum::http::header::COOKIE, value);
    }
    if let Some(value) = headers.get(axum::http::header::AUTHORIZATION) {
        request = request.header(axum::http::header::AUTHORIZATION, value);
    }
    request
}

fn map_cache_key(url: &Url, range: Option<ResolvedByteRange>) -> String {
    match range {
        Some(range) => format!("{}#{}:{}", url.as_str(), range.start, range.end),
        None => url.as_str().to_string(),
    }
}

fn resolve_url(base: &Url, target: &str) -> anyhow::Result<Url> {
    base.join(target).context("Invalid URL")
}

fn hint_extension_from_url(url: &Url) -> Option<String> {
    let path = url.path();
    let ext = path.rsplit('.').next()?;
    if ext == path {
        return None;
    }
    let lowered = ext.to_ascii_lowercase();
    let normalized = match lowered.as_str() {
        "m4s" | "m4a" | "mp4" => "mp4",
        other => other,
    };
    Some(normalized.to_string())
}

fn decode_segment_samples(
    data: Vec<u8>,
    segment_start: f64,
    target_start: f64,
    target_end: f64,
    hint_extension: Option<String>,
    base_time: Option<f64>,
) -> anyhow::Result<Option<DecodedSamples>> {
    decode_samples_from_bytes(
        data,
        hint_extension.as_deref(),
        segment_start,
        target_start,
        target_end,
        base_time,
    )
}

fn decode_samples_from_bytes(
    data: Vec<u8>,
    hint_extension: Option<&str>,
    segment_start: f64,
    target_start: f64,
    target_end: f64,
    base_time: Option<f64>,
) -> anyhow::Result<Option<DecodedSamples>> {
    let mut hint = Hint::new();
    if let Some(ext) = hint_extension {
        hint.with_extension(ext);
    }

    let mss = MediaSourceStream::new(Box::new(Cursor::new(data)), Default::default());
    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .context("Unsupported segment format")?;
    let mut format = probed.format;
    let track = format
        .tracks()
        .iter()
        .find(|track| track.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| anyhow!("No supported audio tracks"))?;
    let track_id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .context("Unsupported audio codec")?;

    let mut cursor_frames: u64 = 0;
    let mut samples: Vec<i16> = Vec::new();
    let mut sample_rate: Option<u32> = None;
    let mut channels: Option<usize> = None;

    let base_time = base_time.unwrap_or(segment_start);

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(SymphoniaError::IoError(_)) => break,
            Err(SymphoniaError::ResetRequired) => return Err(anyhow!("Decoder reset required")),
            Err(err) => return Err(anyhow!("Audio decode error: {err}")),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(audio_buf) => {
                let spec = *audio_buf.spec();
                let current_rate = spec.rate;
                let current_channels = spec.channels.count();
                if sample_rate.is_none() {
                    sample_rate = Some(current_rate);
                    channels = Some(current_channels);
                } else if sample_rate != Some(current_rate) || channels != Some(current_channels) {
                    return Err(anyhow!("Audio format changed within segment"));
                }

                let frame_count = audio_buf.frames();
                if frame_count == 0 {
                    continue;
                }
                let mut sample_buf = SampleBuffer::<i16>::new(frame_count as u64, spec);
                sample_buf.copy_interleaved_ref(audio_buf);

                let channels = current_channels;

                let rate_f = current_rate as f64;
                let buffer_start = base_time + (cursor_frames as f64 / rate_f);
                let buffer_end = buffer_start + (frame_count as f64 / rate_f);
                let overlap_start = target_start.max(buffer_start);
                let overlap_end = target_end.min(buffer_end);

                if overlap_end > overlap_start {
                    let start_frame =
                        ((overlap_start - buffer_start) * rate_f).floor().max(0.0) as usize;
                    let end_frame =
                        ((overlap_end - buffer_start) * rate_f).ceil().max(0.0) as usize;
                    let start_index = start_frame.saturating_mul(channels);
                    let end_index = end_frame
                        .saturating_mul(channels)
                        .min(frame_count.saturating_mul(channels));
                    if end_index > start_index {
                        samples.extend_from_slice(&sample_buf.samples()[start_index..end_index]);
                    }
                }

                cursor_frames = cursor_frames.saturating_add(frame_count as u64);
                if segment_start + (cursor_frames as f64 / rate_f) >= target_end {
                    break;
                }
            }
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(SymphoniaError::IoError(_)) => continue,
            Err(err) => return Err(anyhow!("Audio decode error: {err}")),
        }
    }

    let Some(sample_rate) = sample_rate else {
        return Ok(None);
    };
    let channels = channels.unwrap_or(1);
    if samples.is_empty() {
        return Ok(None);
    }

    Ok(Some(DecodedSamples {
        samples,
        sample_rate,
        channels,
    }))
}

fn ts_packet_size(data: &[u8]) -> Option<usize> {
    if data.len() >= 188 && data.len() % 188 == 0 {
        if data.chunks(188).all(|chunk| chunk.first() == Some(&0x47)) {
            return Some(188);
        }
    }
    if data.len() >= 192 && data.len() % 192 == 0 {
        if data.chunks(192).all(|chunk| chunk.get(4) == Some(&0x47)) {
            return Some(192);
        }
    }
    None
}

fn extract_adts_from_ts(data: &[u8], packet_size: usize) -> AdtsExtraction {
    let sync_offset = if packet_size == 192 { 4 } else { 0 };
    let mut pmt_pid: Option<u16> = None;
    let mut audio_pid: Option<u16> = None;

    for packet in data.chunks(packet_size) {
        if packet.len() < sync_offset + 188 {
            continue;
        }
        if packet[sync_offset] != 0x47 {
            continue;
        }
        let b1 = packet[sync_offset + 1];
        let pusi = (b1 & 0x40) != 0;
        let pid = (((b1 & 0x1f) as u16) << 8) | packet[sync_offset + 2] as u16;
        let b3 = packet[sync_offset + 3];
        let adaptation = (b3 & 0x30) >> 4;
        if adaptation == 0 || adaptation == 2 {
            continue;
        }
        let mut payload_start = sync_offset + 4;
        if adaptation == 3 {
            if payload_start >= packet.len() {
                continue;
            }
            let adap_len = packet[payload_start] as usize;
            payload_start = payload_start.saturating_add(1 + adap_len);
        }
        if payload_start >= sync_offset + 188 {
            continue;
        }
        let payload = &packet[payload_start..sync_offset + 188];

        if pid == 0 {
            parse_pat(payload, pusi, &mut pmt_pid);
        } else if Some(pid) == pmt_pid {
            parse_pmt(payload, pusi, &mut audio_pid);
        }
    }

    let mut pes_payloads: Vec<PesPayload> = Vec::new();
    let mut current_pes: Option<PesPayload> = None;
    let mut force_segment_start = false;

    for packet in data.chunks(packet_size) {
        if packet.len() < sync_offset + 188 {
            continue;
        }
        if packet[sync_offset] != 0x47 {
            continue;
        }
        let b1 = packet[sync_offset + 1];
        let pusi = (b1 & 0x40) != 0;
        let pid = (((b1 & 0x1f) as u16) << 8) | packet[sync_offset + 2] as u16;
        let b3 = packet[sync_offset + 3];
        let adaptation = (b3 & 0x30) >> 4;
        if adaptation == 0 || adaptation == 2 {
            continue;
        }
        let mut payload_start = sync_offset + 4;
        if adaptation == 3 {
            if payload_start >= packet.len() {
                continue;
            }
            let adap_len = packet[payload_start] as usize;
            payload_start = payload_start.saturating_add(1 + adap_len);
        }
        if payload_start >= sync_offset + 188 {
            continue;
        }
        let payload = &packet[payload_start..sync_offset + 188];

        if Some(pid) == audio_pid {
            if pusi {
                if let Some(pes) = current_pes.take() {
                    pes_payloads.push(pes);
                }
                if let Some((pts, data_start)) = parse_pes_header(payload) {
                    let mut data_buf = Vec::new();
                    if data_start < payload.len() {
                        data_buf.extend_from_slice(&payload[data_start..]);
                    }
                    current_pes = Some(PesPayload {
                        pts,
                        data: data_buf,
                    });
                } else {
                    current_pes = Some(PesPayload {
                        pts: None,
                        data: payload.to_vec(),
                    });
                }
            } else if let Some(pes) = current_pes.as_mut() {
                pes.data.extend_from_slice(payload);
            } else {
                force_segment_start = true;
                current_pes = Some(PesPayload {
                    pts: None,
                    data: payload.to_vec(),
                });
            }
        }
    }

    if let Some(pes) = current_pes.take() {
        pes_payloads.push(pes);
    }

    let mut first_pts: Option<u64> = None;
    let mut payloads: Vec<u8> = Vec::new();
    for pes in pes_payloads {
        if first_pts.is_none() && !force_segment_start {
            first_pts = pes.pts;
        }
        payloads.extend_from_slice(&pes.data);
    }

    let mut adts_stream = extract_adts_frames(&payloads);
    if adts_stream.is_empty() {
        adts_stream = extract_adts_frames(data);
    }
    let first_pts = first_pts.map(|pts| pts as f64 / 90_000.0);
    AdtsExtraction {
        data: adts_stream,
        first_pts,
        force_segment_start,
    }
}

fn parse_pat(payload: &[u8], pusi: bool, pmt_pid: &mut Option<u16>) {
    let mut idx = 0usize;
    if pusi {
        if payload.is_empty() {
            return;
        }
        let pointer = payload[0] as usize;
        idx = 1 + pointer;
        if idx >= payload.len() {
            return;
        }
    }
    if payload.len() < idx + 8 || payload[idx] != 0x00 {
        return;
    }
    let section_length = (((payload[idx + 1] & 0x0f) as usize) << 8) | payload[idx + 2] as usize;
    let section_end = idx + 3 + section_length;
    if section_end > payload.len() {
        return;
    }
    let mut i = idx + 8;
    while i + 4 <= section_end.saturating_sub(4) {
        let program_number = ((payload[i] as u16) << 8) | payload[i + 1] as u16;
        let pid = (((payload[i + 2] & 0x1f) as u16) << 8) | payload[i + 3] as u16;
        if program_number != 0 {
            *pmt_pid = Some(pid);
            return;
        }
        i += 4;
    }
}

fn parse_pmt(payload: &[u8], pusi: bool, audio_pid: &mut Option<u16>) {
    let mut idx = 0usize;
    if pusi {
        if payload.is_empty() {
            return;
        }
        let pointer = payload[0] as usize;
        idx = 1 + pointer;
        if idx >= payload.len() {
            return;
        }
    }
    if payload.len() < idx + 12 || payload[idx] != 0x02 {
        return;
    }
    let section_length = (((payload[idx + 1] & 0x0f) as usize) << 8) | payload[idx + 2] as usize;
    let section_end = idx + 3 + section_length;
    if section_end > payload.len() {
        return;
    }
    let program_info_length =
        (((payload[idx + 10] & 0x0f) as usize) << 8) | payload[idx + 11] as usize;
    let mut i = idx + 12 + program_info_length;
    while i + 5 <= section_end.saturating_sub(4) {
        let stream_type = payload[i];
        let pid = (((payload[i + 1] & 0x1f) as u16) << 8) | payload[i + 2] as u16;
        let es_info_length = (((payload[i + 3] & 0x0f) as usize) << 8) | payload[i + 4] as usize;
        if stream_type == 0x0f || stream_type == 0x11 {
            *audio_pid = Some(pid);
            return;
        }
        i += 5 + es_info_length;
    }
}

fn extract_adts_frames(data: &[u8]) -> Vec<u8> {
    let mut frames = Vec::new();
    let mut i = 0usize;
    while i + 7 <= data.len() {
        if is_adts_header(data, i) {
            let frame_len = adts_frame_length(data, i);
            if frame_len < 7 {
                i += 1;
                continue;
            }
            if i + frame_len <= data.len() {
                frames.extend_from_slice(&data[i..i + frame_len]);
                i += frame_len;
                continue;
            }
            break;
        }
        i += 1;
    }
    frames
}

fn parse_pes_header(payload: &[u8]) -> Option<(Option<u64>, usize)> {
    if payload.len() < 9 {
        return None;
    }
    if payload[0] != 0x00 || payload[1] != 0x00 || payload[2] != 0x01 {
        return None;
    }
    let flags = payload[7];
    let pts_dts = (flags >> 6) & 0x03;
    let header_len = payload[8] as usize;
    let data_start = 9usize.saturating_add(header_len);
    if payload.len() < data_start {
        return None;
    }
    let pts = if pts_dts != 0 {
        let pts_offset = 9;
        if pts_offset + 5 > payload.len() {
            None
        } else {
            let b0 = payload[pts_offset];
            let b1 = payload[pts_offset + 1];
            let b2 = payload[pts_offset + 2];
            let b3 = payload[pts_offset + 3];
            let b4 = payload[pts_offset + 4];
            if (b0 & 0x01) == 0 || (b2 & 0x01) == 0 || (b4 & 0x01) == 0 {
                None
            } else {
                Some(
                    (((b0 & 0x0e) as u64) << 29)
                        | ((b1 as u64) << 22)
                        | (((b2 & 0xfe) as u64) << 14)
                        | ((b3 as u64) << 7)
                        | ((b4 & 0xfe) as u64 >> 1),
                )
            }
        }
    } else {
        None
    };
    Some((pts, data_start))
}

fn is_adts_header(data: &[u8], index: usize) -> bool {
    if index + 5 >= data.len() {
        return false;
    }
    if data[index] != 0xff || (data[index + 1] & 0xf0) != 0xf0 {
        return false;
    }
    let layer = (data[index + 1] >> 1) & 0x03;
    if layer != 0 {
        return false;
    }
    let sampling_index = (data[index + 2] >> 2) & 0x0f;
    sampling_index != 0x0f
}

fn adts_frame_length(data: &[u8], index: usize) -> usize {
    (((data[index + 3] & 0x03) as usize) << 11)
        | ((data[index + 4] as usize) << 3)
        | (((data[index + 5] & 0xe0) as usize) >> 5)
}

fn encode_wav_i16(samples: &[i16], sample_rate: u32, channels: u16) -> anyhow::Result<Vec<u8>> {
    let data_len = samples.len() * 2;
    if data_len > u32::MAX as usize {
        return Err(anyhow!("Audio clip is too large"));
    }
    let riff_size = 36u32 + data_len as u32;
    let byte_rate = sample_rate * channels as u32 * 2;
    let block_align = channels * 2;

    let mut output = Vec::with_capacity(44 + data_len);
    output.extend_from_slice(b"RIFF");
    output.extend_from_slice(&riff_size.to_le_bytes());
    output.extend_from_slice(b"WAVE");
    output.extend_from_slice(b"fmt ");
    output.extend_from_slice(&16u32.to_le_bytes());
    output.extend_from_slice(&1u16.to_le_bytes());
    output.extend_from_slice(&channels.to_le_bytes());
    output.extend_from_slice(&sample_rate.to_le_bytes());
    output.extend_from_slice(&byte_rate.to_le_bytes());
    output.extend_from_slice(&block_align.to_le_bytes());
    output.extend_from_slice(&16u16.to_le_bytes());
    output.extend_from_slice(b"data");
    output.extend_from_slice(&(data_len as u32).to_le_bytes());

    for sample in samples {
        output.extend_from_slice(&sample.to_le_bytes());
    }

    Ok(output)
}

fn prepare_segment_audio(data: Vec<u8>, hint_extension: Option<String>) -> PreparedAudio {
    if let Some(packet_size) = ts_packet_size(&data) {
        let extraction = extract_adts_from_ts(&data, packet_size);
        if !extraction.data.is_empty() {
            return PreparedAudio {
                data: extraction.data,
                hint_extension: Some("aac".to_string()),
                first_pts: if extraction.force_segment_start {
                    None
                } else {
                    extraction.first_pts
                },
                force_segment_start: extraction.force_segment_start,
            };
        }
    }

    PreparedAudio {
        data,
        hint_extension,
        first_pts: None,
        force_segment_start: false,
    }
}

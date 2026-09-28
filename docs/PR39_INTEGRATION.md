# PR #39 integration qualification (unreleased)

Baseline: `9d8113e`, by @jayjoe101, incorporates Claude CLI summaries (#28,
@cedstrom), speaker editing (#36, @ampersandru), and per-app audio/Labs (#38,
@ampersandru, including #37). The v0.2.17 Nemotron implementation is retained.

## Recording corrections

- `audio/capture/per_app.rs`: every Windows capture worker acknowledges readiness
  only after `IAudioClient::Start`. Startup waits for all selected apps with one
  eight-second deadline. A disconnected or late acknowledgement fails startup
  and signals all workers to stop. Completed workers are joined; stalled native
  calls retain ownership of their stop flag until they return. The handshake runs
  on `spawn_blocking` in `audio/stream.rs`, not on a capture callback/Tokio worker.
- macOS currently implements one process tap. Selecting multiple apps now fails
  explicitly before starting instead of silently recording only the first.
- `audio/vad.rs` no longer rejects Silero speech turns using a fixed RMS/peak
  floor. `audio/transcription/worker.rs` similarly skips only digital zero at
  its energy gate and no longer blacklists legitimate short replies. Whisper's
  own no-speech checks and optional Labs threshold remain responsible for
  hallucination rejection. These changes do not guarantee quiet-speech accuracy.

## Setup and speaker edit recovery

`app/layout.tsx` paints a setup-status screen before enabling recording. After
eight seconds it offers retry, but still accepts a late authoritative native
response. Failure never implies onboarding completion. An attempt cleanup ignores
responses from replaced attempts.

`lib/live-speaker-edits.ts` journals display edits in localStorage under the
IndexedDB meeting ID. Rename/merge aliases are flattened, and individual-turn
overrides use native sequence IDs because frontend row IDs change on reload.
Writes precede UI edits; failures report that the edit could not be saved.
`TranscriptContext` applies edits to future events and native reload history;
`useTranscriptRecovery` applies them to recovered IndexedDB transcripts before
saving. Native source labels, text, timestamps and audio remain intact. This is
a WebView-storage journal, not a native recording-history rewrite; copying raw
recording files alone does not transport those edits. Journals are meeting-scoped
and retained for crash recovery. Storage cleanup and cross-window editing are
not implemented here.

## Verification

Focused tests cover failed/partial capture readiness, successful readiness,
short-reply retention, meeting isolation, alias restoration, turn overrides,
merges and storage-write failure. Verified on Windows: 343 native CPU library
tests passed (eight model/CLI-dependent tests ignored); 122 frontend tests passed
with mock-heavy groups in separate Bun invocations; Next production build and
type validation passed. The quiet-finalization fixture is synthetic, not a
real-speech accuracy measurement.
The browser preview also completed a sample start/stop/save transition to meeting
details. Preview uses mocked audio/native APIs and does not qualify real capture.
Real Windows/macOS per-app capture, full installed-app upgrade, real-call voice
matching and sustained concurrent GPU inference still require hardware testing.
This branch is not an installed or published release.

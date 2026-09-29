# v0.2.18 — Meeting workspace and clearer recordings

## What's new

- Redesigned meeting workspace with three themes, groups, contacts, action items,
  a command bar, meeting search, and multi-meeting export.
- Live speaker renaming and merging, plus per-app recording with a multi-app
  whitelist on Windows.
- Claude Code CLI summaries using your existing Claude Code installation.
- Optional Labs features: meeting automation, voice profiles, waveform seeking,
  transcript cleanup, stricter Whisper silence handling, and Parakeet GPU support.
- A **Low audio** advisory for quiet system audio. Gain remains under your control.

## Fixes and polish

- **Recording buzz/clicks at capture-block boundaries (#40):** continuous audio
  now keeps its samples intact when callback timing fluctuates. This improves
  newly recorded source tracks and mixed audio, including their previews; it
  does not repair artifacts already present in older files.
- **Missing live speech:** retain the beginning of detected utterances and use
  more sensitive system-audio speech detection. Quiet speech and short replies
  are no longer discarded by fixed loudness/phrase filters.
- **AI-generated meeting titles restored**, with manual names taking priority
  and template placeholders rejected.
- **Post-call processing is nonblocking:** progress appears in a compact bottom
  card so you can interact with the meeting. Speaker choices use a compact,
  centered **Auto-detect & continue** action for Nemotron.
- Restored the single-line blue **Meetily · Actually Free** wordmark.
- More reliable capture-start errors, setup status checks, and recovery of live
  speaker edits after a WebView reload.

Nemotron remains Auto-detect only, with microphone/source provenance preserved.
Live Parakeet and optional post-call Whisper remain independently selectable.

## Contributors

PR #39 bundles other contributors' PRs; credit belongs to the original authors
as well as the integration author:

- **@jayjoe101** — [PR #39](https://github.com/TylerBuza/Meetily-ActuallyFree/pull/39):
  the redesigned interface, meeting workspace, and integration of the features below.
- **@ampersandru** — [PR #36](https://github.com/TylerBuza/Meetily-ActuallyFree/pull/36)
  (live speaker editing and transcription/VAD improvements),
  [PR #37](https://github.com/TylerBuza/Meetily-ActuallyFree/pull/37)
  (per-app recording), and
  [PR #38](https://github.com/TylerBuza/Meetily-ActuallyFree/pull/38)
  (combined features and Labs), incorporated through #39. Also the original
  [PR #34](https://github.com/TylerBuza/Meetily-ActuallyFree/pull/34) Nemotron
  contribution, previously released in v0.2.17 and retained here.
- **@cedstrom** — [PR #28](https://github.com/TylerBuza/Meetily-ActuallyFree/pull/28):
  the Claude Code CLI summary provider, included through #39. Its original
  commits are attributed to **@chris-edstrom**.
- **@fernandog** — the detailed recordings, measurements, and root-cause analysis
  in [issue #40](https://github.com/TylerBuza/Meetily-ActuallyFree/issues/40).
- **@TylerBuza** — integration hardening, recording/transcription corrections,
  UI follow-ups, Windows packaging, and release qualification.

## Verification and status

- 350 native CPU tests passed; nine model/CLI/fixture-dependent tests remained
  ignored in that run.
- 126 frontend tests passed in 22 isolated invocations; production build and type
  checking passed.
- The callback-continuity regression fails before the fix and passes afterward
  at both reported block sizes. These are synthetic continuity tests, not a claim
  that the reporter's physical devices were retested.
- Live-transcription changes were additionally replayed against local real-call
  source tracks using CPU Parakeet. Coverage improved; recognition is not perfect.
- Labs GPU/voice-profile behavior and sustained multi-device accuracy remain
  experimental and hardware-dependent.

- Windows CPU/Vulkan/CUDA payload hashes and updater signatures verified. The
  final candidate was installed locally, matched the packaged executable, and
  passed startup/database checks with existing meeting data and settings preserved.

**Release preparation:** v0.2.18 is prepared as a draft, not published.
The public release remains v0.2.17. See the development map's linked qualification
notes for the exact installed-build and test scope.

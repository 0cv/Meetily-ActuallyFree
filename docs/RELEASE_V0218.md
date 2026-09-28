# v0.2.18 — Meeting workspace (local test candidate)

- Redesigned interface with three themes, groups, contacts, action items,
  meeting search and multi-meeting export.
- Live speaker editing, per-app recording and opt-in Labs features, including
  meeting automation, voice profiles and waveform seeking.
- Claude Code CLI summaries; existing Nemotron live/post-call diarization retained.
- Quiet-speech retention fixes and a visible **Low audio** advisory on the system
  meter. Raise System volume in Output settings if speech is too quiet; **Too loud**
  takes priority when audio hits the limiter.
- Capture-start error reporting, reliable setup gating and speaker-edit recovery.
- Restored AI-generated meeting titles for automatically named meetings, while
  preserving manual names and rejecting unfilled template placeholders.

## Contributors

- @jayjoe101 — redesigned interface and workspace integration in PR #39.
- @ampersandru — speaker controls, per-app recording and Labs in PRs #36–#38,
  plus the original Nemotron contribution in PR #34.
- @cedstrom — Claude Code CLI provider in PR #28.

This is a local qualification build, not a published GitHub release. Real-call
capture and experimental GPU/voice-profile behavior still need hardware testing.

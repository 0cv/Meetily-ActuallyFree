# Recording callback continuity — issue #40

## macOS microphone callback — issue #42 (unqualified)

### Follow-up after v0.2.19-macos (2026-10-01)

The reporter observed clear microphone checkpoint audio in one meeting, but
Stop hung and several intervals of live transcription were missing. A later
meeting only retained the first few seconds of microphone audio. This is not
confirmation that #42 is fixed.

The v0.2.19 worker waited for channel disconnection before exiting. CPAL 0.15.3's
macOS `add_disconnect_listener` retains a cloned stream in a listener owned by
that stream; dropping the public stream need not release its callback/sender.
Consequently `worker.join()` could wait forever even with an empty audio queue.

`audio/capture_worker.rs` now owns an explicit close signal. After capture is
paused, it drains accepted blocks and exits when the queue is empty, independent
of callback ownership. Receive waits check close every 20 ms. The caller allows
two seconds for processing, reports timeout/panic through the existing Stop
error/final-save path, and cancels pending work on timeout. A native DSP call
already in progress cannot be forcibly interrupted; it may finish after timeout.
Dropping the worker during stream creation/play failure also cancels its queue.
The existing 256-block capacity, callback timestamps and source labels remain.

Five tests compile the actual std-only worker module directly with `rustc --test`
on Windows: retained callback plus ordered audio/timestamp drain, blocked DSP
with bounded Stop, full-queue nonblocking send, DSP panic reporting, and early
owner drop. All passed using synthetic blocks and synchronization gates; no
recording, speech model, or Mac device was used. The Windows native audio suite
also compiled with the existing LLVM 18 helper: 143 tests passed, three opt-in
tests were ignored, and the new short-loss regression exposed an initial recovery
alignment error. After correcting it, all 17 pipeline regressions passed,
including jitter/drift preservation and both new recovery cases. No private
recording or real-microphone capture was used. This follow-up is not part of the
published v0.2.19 preview.

Apple Silicon candidate run `36872151061` at `8bf63ec` subsequently passed the
five capture-worker tests, all 17 pipeline tests, native build, bundle checks,
and repeated app launch. Frontend CI `36872130895` also passed. The artifact is
a test build with internal version 0.2.19, **not** the DMG published under
`v0.2.19-macos`; it does not change that immutable release. These are synthetic
regressions and CI launch checks, not physical mic capture or ASR accuracy tests.

There is also a source-clock recovery bug: after a short loss below the 100 ms
callback-gap threshold, the mixer may already have emitted silence past the
source's sample counter. Continuous resumed callbacks can then be trimmed
forever as stale. An empty source which has missed a full mixing window (50 ms
by default), or whose sample counter is behind emitted audio, now reanchors only
when its callback timestamp reaches un-emitted audio. Old
queued samples still get discarded; normal callback jitter still uses sample
counting. Regressions cover an 80 ms mic loss with a continuing system track,
and stale queued frames followed by a fresh frame. This affects source tracks,
mixed playback, and the VAD input without changing transcript text or labels.

The Mac build workflow now gates artifacts on the capture-worker and pipeline
regressions. Reporter-device confirmation is still needed. Audio present in
checkpoints but absent from text must also be investigated in VAD, ASR, or
transcript delivery; neither correction proves that those particular gaps are
resolved. The reporter's app log around onset/Stop, selected microphone and
transcription model, and macOS version would distinguish the remaining paths.

### v0.2.19 capture handoff

The macOS microphone is a CPAL input stream, **not** the CoreAudio system-audio
tap mentioned in the issue attachment. CPAL used to perform resampling,
normalization, and pipeline delivery synchronously in the device callback.
It now copies each microphone block and its recording-relative callback timestamp
into a bounded 256-block queue. A dedicated native worker owns the existing
stateful DSP and pipeline send. On stop, capture is paused and the worker drains
accepted blocks before recording state and the pipeline are stopped. System
audio and non-macOS CPAL paths are unchanged. Queue exhaustion drops blocks
instead of blocking the device thread; the worker reports the first overflow
and logs that audio was lost. The queue is bounded by blocks, not by bytes, so
device buffer size also determines the maximum buffered time and memory.

A synthetic regression has been added for deferred processing's callback
timestamp, but native tests did not run locally: the Windows `cargo check`
stops in the existing `whisper-rs` generated bindings before compiling this
crate. The regression does not reproduce several-minute distortion or
establish that this change fixes the reporter's device. Physical macOS mic/system capture
with live inference, pause/stop, and saved-track playback is still required.
The attached CoreAudio `should_terminate`/`poll_next` hypothesis concerns the
separate system-audio stream. That path now drops samples rather than permanently
terminating after ten full callbacks, and rechecks the ring buffer after waker
registration so a push during registration cannot strand the consumer. This
prevents a system-tap stall from stopping the entire meeting, but is **not** a
verified explanation for distortion on the microphone track.

## Report and reproduction

[@fernandog's report](https://github.com/TylerBuza/Meetily-ActuallyFree/issues/40)
identified speech-dependent broadband artifacts at 480-sample wired-microphone
and 384-sample Bluetooth capture boundaries. The report concerns the saved
microphone/mixed files, not merely the preview player.

`useMeetingAudio.ts` streams the saved file through an HTML audio element. The
native mixer previously positioned **every** block from a callback-delivery
timestamp. That clock jitters relative to the device sample clock. Sub-millisecond
timing differences therefore caused zero insertion or sample deletion inside a
continuous waveform, before both source-track persistence and live VAD.

A regression supplies continuous synthetic sine samples in the reported block
sizes with opposing ±0.3 ms microphone/system callback jitter. It failed on the
old implementation at the 480-sample microphone case. With the correction, both
tracks preserve every input sample at both block sizes.

## Timing ownership

`audio/pipeline.rs::AudioMixerRingBuffer` owns one `SourceSampleClock` per source.
Each clock tracks a next-sample index relative to the shared mixer origin and
the last callback-end timestamp in recording-relative seconds.

- First input anchors the source to recording time, preserving late-source
  startup alignment. Subsequent continuous blocks advance by their sample count.
- Only a callback-free interval greater than 100 ms reanchors a returning source
  to wall time. This matches the default two-window missing-source allowance.
  Normal jitter and gradual delivery-clock drift do not splice the waveform.
- Already-emitted silence cannot be replaced: a genuinely late block's elapsed
  prefix is still trimmed, but its sample clock advances by the original length.
- Existing bounded buffering, source zero-padding, and large-gap reset behavior
  remain. A large shared timeline reset now also clears both source clocks.
- Empty/mixed inputs do not advance source clocks. Muted source callbacks still
  supply aligned zeros. Device provenance, ASR/diarizer selection, capture-worker
  ownership, gain, and saved-file formats are unchanged.

This adds constant-size clock state; no new worker, queue, inference, or blocking
capture operation is introduced.

## Qualification and remaining limits

Fourteen mixer tests passed, including bit-for-bit jittered-block preservation,
one minute of simulated gradual clock drift, a real 200 ms source gap followed
by jittered resumption, late-source startup, equal-length tails, bounded large
gaps, mute behavior, and gain handling. The complete native CPU suite subsequently
passed **350 tests**, with **nine opt-in tests ignored**. These new continuity
tests use synthetic samples, not real microphones or speech recognition.

The UI progress change was independently exercised in browser preview: enhancing
had no dialog/backdrop, body pointer events were enabled, an actual mouse click
opened About behind the progress card, and the transcription-start call count
stayed at one. The frontend suite passed **126 tests in 22 isolated invocations**;
production build and type checking passed.

The 100 ms gap decision is a delivery-time heuristic, not hardware timestamp
recovery. Severe scheduling stalls can still look like missing capture. There is
no adaptive resampling to compensate long-run oscillator drift between devices;
this correction prioritizes preserving continuous samples over repeatedly
cutting them to fit wall time. Hardware testing on the reporter's wired/Bluetooth
devices and sustained two-source load remains separate qualification.

Existing damaged recordings are not rewritten: deleted samples cannot be
reconstructed by changing playback. The correction applies to newly captured
audio. Private recordings, diagnostic output, and fixtures stay outside Git.

## Installed release-candidate check

The final CPU/Vulkan/CUDA v0.2.18 Windows payload was built and passed
`verify-windows-release.mjs` (updater signatures, hashes, runtime files, and
bootstrapper payload). After backing up the existing install and native/WebView
data, the installed CUDA executable matched the packaged SHA-256. Startup IPC
confirmed v0.2.18, completed onboarding, selected/available Nemotron, and a ready
workspace. The app exited cleanly through native IPC and reopened without debug
flags after the check.

SQLite integrity passed. Eight meetings, 157 transcript rows, four people, seven
person-speaker links, model hashes, and preference values were preserved. This
is local installation/startup qualification, not a new microphone capture test.
The reporter's devices remain untested here. v0.2.18 is prepared as a draft;
publication is separate from this verified local installation.

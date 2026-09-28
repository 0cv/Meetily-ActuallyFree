'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw, ScrollText, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hint } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { PLAYBACK_RATES, type MeetingAudioControls } from '@/hooks/useMeetingAudio';

export function formatPlayback(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return !!element.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]');
}

/**
 * Transport for a meeting's recording, docked under the transcript. Space
 * toggles playback when focus is not in a text field.
 */
export function AudioPlayerBar({
  audio,
  follow,
  onFollowChange,
}: {
  audio: MeetingAudioControls;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
}) {
  const { status, playing, currentTime, duration, rate } = audio;
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const shown = scrubbing ?? currentTime;
  const progress = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0;

  useEffect(() => {
    if (status !== 'ready') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTyping(event.target)) return;
      event.preventDefault();
      audio.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, audio]);

  if (status === 'unavailable' || status === 'error') {
    return (
      <div className="flex h-14 items-center gap-2 border-t border-af-border px-4 text-xs text-af-text-3">
        <VolumeX className="h-3.5 w-3.5 shrink-0" />
        {status === 'error' ? 'The recording could not be played.' : 'No audio was saved for this meeting.'}
      </div>
    );
  }

  const positionAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
  };

  const startScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (status !== 'ready') return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    setScrubbing(positionAt(event.clientX));
    const move = (moveEvent: PointerEvent) => setScrubbing(positionAt(moveEvent.clientX));
    const end = (endEvent: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      audio.seek(positionAt(endEvent.clientX));
      setScrubbing(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate) + 1) % PLAYBACK_RATES.length];
  const button =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-af-text-2 transition-colors hover:bg-af-hover hover:text-af-text disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent/60';

  return (
    // h-14 matches the sidebar footer, so their top borders line up.
    <div className="flex h-14 items-center gap-1 border-t border-af-border bg-af-panel px-3">
      <Hint label="Back 10 seconds">
        <button type="button" className={button} onClick={() => audio.skip(-10)} disabled={status !== 'ready'} aria-label="Back 10 seconds">
          <RotateCcw className="h-4 w-4" />
        </button>
      </Hint>
      <Hint label={playing ? 'Pause' : 'Play'} shortcut="Space">
        <button
          type="button"
          onClick={audio.toggle}
          disabled={status !== 'ready'}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-af-accent text-af-on-accent shadow-sm transition-[background-color,transform] hover:bg-af-accent-hover active:scale-95 disabled:opacity-50"
        >
          {status === 'loading' ? <Spinner size={14} /> : playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
        </button>
      </Hint>
      <Hint label="Forward 10 seconds">
        <button type="button" className={button} onClick={() => audio.skip(10)} disabled={status !== 'ready'} aria-label="Forward 10 seconds">
          <RotateCw className="h-4 w-4" />
        </button>
      </Hint>

      <span className="ml-1.5 w-12 shrink-0 text-right text-[11px] tabular-nums text-af-text-2">{formatPlayback(shown)}</span>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        tabIndex={status === 'ready' ? 0 : -1}
        onPointerDown={startScrub}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') audio.skip(-5);
          if (event.key === 'ArrowRight') audio.skip(5);
        }}
        className="group relative mx-2 flex h-8 min-w-0 flex-1 cursor-pointer items-center focus-visible:outline-none"
      >
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-af-text/[0.1] transition-[height] duration-150 group-hover:h-1.5">
          <div className="absolute inset-y-0 left-0 rounded-full bg-af-accent" style={{ width: `${progress}%` }} />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-af-text shadow-md opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ left: `${progress}%`, opacity: scrubbing !== null ? 1 : undefined }}
        />
      </div>
      <span className="w-12 shrink-0 text-[11px] tabular-nums text-af-text-4">{formatPlayback(duration)}</span>

      <Hint label="Playback speed">
        <button
          type="button"
          onClick={() => audio.setRate(nextRate)}
          disabled={status !== 'ready'}
          className="h-7 min-w-[2.75rem] shrink-0 rounded-md px-1.5 text-[11px] font-semibold tabular-nums text-af-text-2 transition-colors hover:bg-af-hover hover:text-af-text disabled:opacity-40"
        >
          {rate}×
        </button>
      </Hint>
      <Hint label={follow ? 'Stop following the playback' : 'Follow the playback'}>
        <button
          type="button"
          onClick={() => onFollowChange(!follow)}
          aria-pressed={follow}
          className={cn(button, follow && 'bg-af-accent/[0.12] text-af-accent hover:bg-af-accent/[0.18] hover:text-af-accent')}
          aria-label="Follow the playback"
        >
          <ScrollText className="h-4 w-4" />
        </button>
      </Hint>
    </div>
  );
}

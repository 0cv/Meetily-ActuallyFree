'use client';

import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { RecordingCardSlot } from '@/components/RecordingCardSlot';

/**
 * The record card's successor. Stopping, saving, and the speaker question all
 * use this same bottom card, styled like the record card, so the handoff never
 * jumps between popups.
 */
export function PostCallHandoffCard({
  title,
  detail,
  busy = false,
  icon,
  children,
}: {
  title: string;
  detail?: string;
  busy?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <RecordingCardSlot>
      <div className="pointer-events-auto w-full max-w-[36rem] animate-af-rise rounded-[26px] border border-af-border-strong bg-af-elevated/95 px-5 py-4 text-af-text shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-af-accent/[0.12] text-af-accent">
            {busy ? <Spinner size={18} /> : icon ?? <Users size={18} strokeWidth={1.75} />}
          </span>
          <div className="min-w-0 text-left leading-tight">
            <div className="text-sm font-semibold tracking-tight">{title}</div>
            {detail && <div className="mt-0.5 text-xs text-af-text-3">{detail}</div>}
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </RecordingCardSlot>
  );
}

'use client';

/**
 * One header for a meeting: the title (edit in place), when it happened, its
 * group, who was there, Export, and a ⋯ menu for everything else.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import {
  AudioLines,
  ClipboardCopy,
  Download,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AvatarStack } from '@/components/ui/avatar';
import { Hint } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GroupPicker } from '@/components/groups/GroupBits';
import { RetranscribeDialog } from '@/components/MeetingDetails/RetranscribeDialog';
import { useConfig } from '@/contexts/ConfigContext';
import { formatDuration, parseDate } from '@/lib/dates';
import { timeRange } from '@/lib/meeting-titles';

export interface MeetingHeaderProps {
  meetingId: string;
  title: string;
  createdAt?: string;
  durationSeconds?: number;
  folderPath?: string | null;
  groupId: string | null;
  onGroupChange: (groupId: string | null) => void;
  onRename: (title: string) => Promise<boolean>;
  participants: string[];
  unidentified: number;
  onExport: () => void;
  onCopyTranscript: () => void;
  onCopySummary: () => void;
  hasSummary: boolean;
  onOpenFolder: () => void;
  onDelete: () => Promise<void>;
  /** After speakers are re-identified or the transcript is enhanced. */
  onTranscriptChanged: () => Promise<void> | void;
}

function EditableHeading({ value, onCommit }: { value: string; onCommit: (next: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => ref.current?.select());
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === value) {
      setEditing(false);
      setDraft(value);
      return;
    }
    const ok = await onCommit(next);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void commit();
          if (event.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        aria-label="Meeting title"
        className="af-bare -ml-1.5 w-full min-w-0 rounded-md !border !border-af-accent !bg-af-panel-2 px-1.5 py-0.5 text-lg font-semibold tracking-tight text-af-text outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group/title -ml-1.5 flex min-w-0 max-w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-af-hover"
      title="Rename"
    >
      <h1 className="truncate text-lg font-semibold tracking-tight text-af-text">{value}</h1>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-af-text-4 opacity-0 transition-opacity group-hover/title:opacity-100" />
    </button>
  );
}

export function MeetingHeader({
  meetingId,
  title,
  createdAt,
  durationSeconds,
  folderPath,
  groupId,
  onGroupChange,
  onRename,
  participants,
  unidentified,
  onExport,
  onCopyTranscript,
  onCopySummary,
  hasSummary,
  onOpenFolder,
  onDelete,
  onTranscriptChanged,
}: MeetingHeaderProps) {
  const router = useRouter();
  const { betaFeatures } = useConfig();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [identifyOpen, setIdentifyOpen] = useState(false);
  const [expected, setExpected] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [diarizeAvailable, setDiarizeAvailable] = useState(false);
  const [enhanceOpen, setEnhanceOpen] = useState(false);

  useEffect(() => {
    invoke<boolean>('diarization_models_available').then(setDiarizeAvailable).catch(() => setDiarizeAvailable(false));
  }, []);

  const start = parseDate(createdAt);
  const end = start && durationSeconds ? new Date(start.getTime() + durationSeconds * 1000) : null;
  const when = start
    ? `${start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: start.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })} · ${end ? timeRange(start, end) : start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : null;

  const identify = useCallback(async () => {
    const count = parseInt(expected, 10);
    setIdentifyOpen(false);
    setIdentifying(true);
    const toastId = toast.loading('Identifying speakers…', { description: 'Analyzing the recording on this device.' });
    try {
      const result = await invoke<{ num_speakers: number; labeled: number }>('diarize_meeting', {
        meetingId,
        numSpeakers: Number.isFinite(count) && count > 0 ? count : null,
      });
      toast.success(result.num_speakers > 0 ? `Found ${result.num_speakers} speaker${result.num_speakers === 1 ? '' : 's'}` : 'No speakers detected', {
        id: toastId,
        description: `${result.labeled} lines labelled.`,
      });
      await onTranscriptChanged();
    } catch (error) {
      toast.error('Speaker identification failed', { id: toastId, description: error instanceof Error ? error.message : String(error) });
    } finally {
      setIdentifying(false);
    }
  }, [expected, meetingId, onTranscriptChanged]);

  return (
    <header className="shrink-0 border-b border-af-border px-5 pb-3 pt-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <EditableHeading value={title} onCommit={onRename} />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-af-text-3">
            {when && <span className="tabular-nums">{when}</span>}
            {durationSeconds ? <span className="tabular-nums">{formatDuration(durationSeconds)}</span> : null}
            <GroupPicker value={groupId} onChange={onGroupChange} placeholder="Add to group" />
            {(participants.length > 0 || unidentified > 0) && (
              <span className="flex items-center gap-2">
                {participants.length > 0 && <AvatarStack names={participants} max={4} size="sm" />}
                <span>
                  {participants.length > 0 && `${participants.length} identified`}
                  {participants.length > 0 && unidentified > 0 && ' · '}
                  {unidentified > 0 && `${unidentified} unidentified`}
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {identifying && (
            <span className="mr-1 flex items-center gap-1.5 text-xs text-af-text-3">
              <Spinner size={13} /> Identifying…
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={onExport}>
            <Download />
            Export
          </Button>
          <DropdownMenu>
            <Hint label="More">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More meeting actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={onCopyTranscript}>
                <ClipboardCopy />
                Copy transcript
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onCopySummary} disabled={!hasSummary}>
                <FileText />
                Copy summary
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenFolder}>
                <FolderOpen />
                Open recording folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {diarizeAvailable && (
                <DropdownMenuItem
                  onSelect={() => {
                    setExpected('');
                    setIdentifyOpen(true);
                  }}
                  disabled={identifying}
                >
                  <Users />
                  Identify speakers again
                </DropdownMenuItem>
              )}
              {betaFeatures.importAndRetranscribe && folderPath && (
                <DropdownMenuItem onSelect={() => setEnhanceOpen(true)}>
                  <Wand2 />
                  Enhance transcript
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="danger" onSelect={() => setConfirmDelete(true)}>
                <Trash2 />
                Delete meeting…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        variant="danger"
        title="Delete this meeting?"
        description="The transcript, summary, notes, and action items are removed. Audio files stay in your recordings folder."
        confirmLabel="Delete"
        onConfirm={async () => {
          await onDelete();
          router.push('/');
        }}
      />

      <Dialog open={identifyOpen} onOpenChange={setIdentifyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-af-accent" />
              Identify speakers again
            </DialogTitle>
            <DialogDescription>How many people spoke, including you? Leave it blank to let the app decide.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              min={1}
              max={20}
              autoFocus
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void identify()}
              placeholder="Detect automatically"
            />
            <div className="flex flex-wrap gap-1.5">
              {[2, 3, 4, 5, 6, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setExpected(String(count))}
                  className={cn(
                    'h-8 min-w-9 rounded-lg border px-2 text-xs font-medium transition-colors',
                    expected === String(count) ? 'border-af-accent bg-af-accent text-af-on-accent' : 'border-af-border text-af-text-2 hover:bg-af-hover',
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIdentifyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void identify()}>{expected ? `Find ${expected} speakers` : 'Detect automatically'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {betaFeatures.importAndRetranscribe && folderPath && (
        <RetranscribeDialog
          open={enhanceOpen}
          onOpenChange={setEnhanceOpen}
          meetingId={meetingId}
          meetingFolderPath={folderPath}
          onComplete={() => void onTranscriptChanged()}
        />
      )}
    </header>
  );
}

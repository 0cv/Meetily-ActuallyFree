'use client';

/**
 * The rich-text editor behind meeting notes and the editable AI summary.
 * Themed through the --bn-* variables in globals.css. Content loads once per
 * mount (remount with a new `key` to load different content), and every edit
 * reports both BlockNote JSON (exact) and markdown (for search, export, AI).
 */
import { useEffect, useRef } from 'react';
import type { Block, PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import '@blocknote/shadcn/style.css';
import { cn } from '@/lib/utils';
import { themeInfo, useAppTheme } from '@/lib/app-theme';
import { blocksToMarkdownSafely } from '@/lib/blocknote-markdown';

export interface NotesContent {
  json: Block[];
  markdown: string;
}

export interface NotesEditorProps {
  initialBlocks?: unknown[] | null;
  initialMarkdown?: string | null;
  placeholder?: string;
  editable?: boolean;
  onChange?: (content: NotesContent) => void;
  className?: string;
  /** Called once the initial content is in the editor. */
  onReady?: () => void;
}

export function NotesEditor({
  initialBlocks,
  initialMarkdown,
  placeholder = 'Write your notes…',
  editable = true,
  onChange,
  className,
  onReady,
}: NotesEditorProps) {
  const [theme] = useAppTheme();
  const loaded = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useCreateBlockNote({
    initialContent: initialBlocks && initialBlocks.length > 0 ? (initialBlocks as PartialBlock[]) : undefined,
    placeholders: { emptyDocument: placeholder, default: "Type '/' for headings, lists, and checklists" },
  });

  // Markdown-only content is parsed after the editor exists.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!(initialBlocks && initialBlocks.length > 0) && initialMarkdown?.trim()) {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown);
          if (!cancelled) editor.replaceBlocks(editor.document, blocks);
        } catch (error) {
          console.error('Could not read notes as markdown', error);
        }
      }
      // Let the replace settle before edits count as changes.
      window.setTimeout(() => {
        if (cancelled) return;
        loaded.current = true;
        onReady?.();
      }, 60);
    };
    void load();
    return () => {
      cancelled = true;
    };
    // Content is loaded once per mount; callers remount to load new content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // If converting to markdown ever fails, keep the last good markdown rather
  // than saving an empty one next to the (still correct) blocks.
  const lastMarkdown = useRef(initialMarkdown ?? '');
  useEffect(() => {
    return editor.onChange(async () => {
      if (!loaded.current || !onChangeRef.current) return;
      const result = await blocksToMarkdownSafely(editor, editor.document, { source: 'notes-editor', fallbackMarkdown: lastMarkdown.current });
      if (result.ok && result.markdown !== undefined) lastMarkdown.current = result.markdown;
      onChangeRef.current?.({ json: editor.document, markdown: result.markdown ?? lastMarkdown.current });
    });
  }, [editor]);

  return (
    <div className={cn('af-notes-editor', className)}>
      <BlockNoteView editor={editor} editable={editable} theme={themeInfo(theme).dark ? 'dark' : 'light'} />
    </div>
  );
}

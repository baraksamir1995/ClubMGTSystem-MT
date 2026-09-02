'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bold, Italic, Underline, Heading2, Heading3,
  List, ListOrdered, Link2, Unlink, Undo2, Redo2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * RichTextEditor — a small contentEditable editor covering the formatting
 * the announcement body needs: bold, italic, underline, H2/H3, bullet and
 * numbered lists, and links.
 *
 *   <RichTextEditor value={html} onChange={setHtml} />
 *
 * Deliberately built on `document.execCommand` rather than pulling in
 * TipTap/Quill/Slate: the whole requirement is a dozen commands, the
 * project has no editor dependency to extend, and gym-admin builds with
 * no network in Coolify — every byte added here is a byte that has to
 * come down at build time. execCommand is formally deprecated but is
 * implemented consistently by every browser this dashboard supports, and
 * there is no replacement API for rich-text editing.
 *
 * The HTML this produces is NEVER trusted. clby-api runs it through
 * App\Services\HtmlSanitizer on write, against a tag/attribute allowlist,
 * so what comes back out is safe for dangerouslySetInnerHTML.
 */

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

interface ToolButton {
  icon: ReactNode;
  label: string;
  /** execCommand name, or a custom handler key. */
  command: string;
  value?: string;
  /** Rendered as a divider before this button. */
  separatorBefore?: boolean;
}

const TOOLS: ToolButton[] = [
  { icon: <Bold className="w-4 h-4" aria-hidden />,        label: 'Bold',           command: 'bold' },
  { icon: <Italic className="w-4 h-4" aria-hidden />,      label: 'Italic',         command: 'italic' },
  { icon: <Underline className="w-4 h-4" aria-hidden />,   label: 'Underline',      command: 'underline' },
  { icon: <Heading2 className="w-4 h-4" aria-hidden />,    label: 'Heading',        command: 'formatBlock', value: 'h2', separatorBefore: true },
  { icon: <Heading3 className="w-4 h-4" aria-hidden />,    label: 'Subheading',     command: 'formatBlock', value: 'h3' },
  { icon: <List className="w-4 h-4" aria-hidden />,        label: 'Bullet list',    command: 'insertUnorderedList', separatorBefore: true },
  { icon: <ListOrdered className="w-4 h-4" aria-hidden />, label: 'Numbered list',  command: 'insertOrderedList' },
  { icon: <Link2 className="w-4 h-4" aria-hidden />,       label: 'Insert link',    command: 'createLink', separatorBefore: true },
  { icon: <Unlink className="w-4 h-4" aria-hidden />,      label: 'Remove link',    command: 'unlink' },
  { icon: <Undo2 className="w-4 h-4" aria-hidden />,       label: 'Undo',           command: 'undo', separatorBefore: true },
  { icon: <Redo2 className="w-4 h-4" aria-hidden />,       label: 'Redo',           command: 'redo' },
];

/** Commands whose pressed state we reflect in the toolbar. */
const STATEFUL = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write the update…',
  id,
  className,
  ...aria
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [empty, setEmpty] = useState(true);

  // Push `value` in only when it differs from what's already rendered.
  // Assigning innerHTML on every keystroke would collapse the caret to
  // the start of the field on each character typed.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value ?? '';
    }
    setEmpty(!el.textContent?.trim() && !el.querySelector('img'));
  }, [value]);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEmpty(!el.textContent?.trim());
    onChange(el.innerHTML);
  }, [onChange]);

  const refreshActive = useCallback(() => {
    if (typeof document === 'undefined') return;
    const next: Record<string, boolean> = {};
    for (const cmd of STATEFUL) {
      try { next[cmd] = document.queryCommandState(cmd); } catch { next[cmd] = false; }
    }
    setActive(next);
  }, []);

  const exec = useCallback((tool: ToolButton) => {
    const el = ref.current;
    if (!el) return;

    // execCommand acts on the document selection, so the editable region
    // has to hold focus before the command runs — clicking a toolbar
    // button would otherwise have moved focus to the button.
    el.focus();

    if (tool.command === 'createLink') {
      const url = window.prompt('Link URL', 'https://');
      if (!url) return;
      // Mirrors the API-side scheme allowlist so an unusable link can't
      // be created in the first place; the server still re-checks.
      if (!/^(https?:|mailto:|\/)/i.test(url.trim())) {
        window.alert('Links must start with http://, https://, mailto: or /');
        return;
      }
      document.execCommand('createLink', false, url.trim());
    } else if (tool.command === 'formatBlock') {
      // Toggle: pressing H2 inside an existing H2 returns to a paragraph.
      const current = document.queryCommandValue('formatBlock')?.toLowerCase();
      const target = current === tool.value ? 'p' : tool.value!;
      document.execCommand('formatBlock', false, `<${target}>`);
    } else {
      document.execCommand(tool.command, false, tool.value);
    }

    sync();
    refreshActive();
  }, [sync, refreshActive]);

  // Plain-text paste. Pasting from Word/Docs otherwise drops a mountain
  // of inline styles and span soup into the body — all of which the API
  // sanitiser strips anyway, so the editor would visibly "lose" the
  // formatting a moment after saving.
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    sync();
  }, [sync]);

  return (
    <div className={cn('rounded-lg border border-line-strong bg-surface-2 overflow-hidden', className)}>
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-line bg-surface-3/50"
      >
        {TOOLS.map(tool => (
          <span key={tool.command + (tool.value ?? '')} className="contents">
            {tool.separatorBefore && (
              <span className="w-px h-5 bg-line mx-1" aria-hidden />
            )}
            <button
              type="button"
              // onMouseDown + preventDefault keeps the selection alive:
              // a plain onClick would blur the editable first and the
              // command would apply to nothing.
              onMouseDown={e => { e.preventDefault(); exec(tool); }}
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={STATEFUL.includes(tool.command) ? !!active[tool.command] : undefined}
              className={cn(
                'inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                'text-fg-muted hover:text-fg hover:bg-surface-4',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                active[tool.command] && 'bg-surface-4 text-brand',
              )}
            >
              {tool.icon}
            </button>
          </span>
        ))}
      </div>

      {/* Editable surface. `rich-text` styles the generated markup — see
          globals.css — so the editor and the tenant popup render the
          same HTML identically. */}
      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute top-3 left-3 text-sm text-fg-faint select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          id={id}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          onPaste={handlePaste}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          className={cn(
            'rich-text min-h-[180px] max-h-[420px] overflow-y-auto p-3 text-sm text-fg',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          )}
          {...aria}
        />
      </div>
    </div>
  );
}

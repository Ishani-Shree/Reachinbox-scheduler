import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronsUpDown,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { cn } from '../../utils/cn';

interface RichTextEditorProps {
  onChange: (html: string) => void;
  placeholder?: string;
}

const STATEFUL = ['bold', 'italic', 'underline', 'strikeThrough', 'insertOrderedList', 'insertUnorderedList'];

/**
 * Lightweight rich-text editor (contentEditable + execCommand). execCommand is
 * deprecated but still supported by every browser and is enough for email
 * formatting. The backend sanitises the HTML before storing or sending it.
 */
export function RichTextEditor({ onChange, placeholder = 'Type Your Reply...' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const [active, setActive] = useState<Record<string, boolean>>({});

  const sync = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setEmpty(!el.textContent?.trim() && !el.querySelector('li,img'));
    onChange(el.innerHTML);
  }, [onChange]);

  // Reflect bold/italic/list state of the caret in the toolbar.
  useEffect(() => {
    const onSelection = () => {
      if (!editorRef.current?.contains(document.getSelection()?.anchorNode ?? null)) return;
      setActive(Object.fromEntries(STATEFUL.map((c) => [c, document.queryCommandState(c)])));
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    sync();
  };

  const toggleQuote = () => {
    const inQuote = document.queryCommandValue('formatBlock').toLowerCase() === 'blockquote';
    exec('formatBlock', inQuote ? 'div' : 'blockquote');
  };

  return (
    <div className="flex min-h-[340px] flex-col rounded-xl bg-ink-50">
      <div className="relative px-4 pt-3">
        {empty && <span className="pointer-events-none absolute left-4 top-3 text-sm text-ink-400">{placeholder}</span>}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Email body"
          onInput={sync}
          className="email-body min-h-[24px] text-sm leading-relaxed text-ink-900 focus:outline-none"
        />
      </div>

      <div
        className="mx-3 my-2 flex flex-wrap items-center gap-0.5 rounded-full bg-white px-2 py-1"
        onMouseDown={(e) => e.preventDefault() /* keep the text selection while clicking tools */}
      >
        <Tool icon={Undo2} label="Undo" onClick={() => exec('undo')} />
        <Tool icon={Redo2} label="Redo" onClick={() => exec('redo')} />
        <Divider />
        <FontSizeMenu onPick={(size) => exec('fontSize', size)} />
        <Divider />
        <Tool icon={Bold} label="Bold" active={active.bold} onClick={() => exec('bold')} />
        <Tool icon={Italic} label="Italic" active={active.italic} onClick={() => exec('italic')} />
        <Tool icon={Underline} label="Underline" active={active.underline} onClick={() => exec('underline')} />
        <Divider />
        <AlignMenu onPick={(cmd) => exec(cmd)} />
        <Divider />
        <Tool
          icon={ListOrdered}
          label="Numbered list"
          active={active.insertOrderedList}
          onClick={() => exec('insertOrderedList')}
        />
        <Tool
          icon={List}
          label="Bulleted list"
          active={active.insertUnorderedList}
          onClick={() => exec('insertUnorderedList')}
        />
        <Tool icon={IndentIncrease} label="Indent" onClick={() => exec('indent')} />
        <Tool icon={IndentDecrease} label="Outdent" onClick={() => exec('outdent')} />
        <Tool icon={Quote} label="Quote" onClick={toggleQuote} />
        <Tool icon={RemoveFormatting} label="Clear formatting" onClick={() => exec('removeFormat')} />
        <Divider />
        <Tool
          icon={Strikethrough}
          label="Strikethrough"
          active={active.strikeThrough}
          onClick={() => exec('strikeThrough')}
        />
      </div>

      {/* The rest of the grey area focuses the editor, so the whole box feels like one input. */}
      <div className="flex-1 cursor-text" onClick={() => editorRef.current?.focus()} />
    </div>
  );
}

function Tool({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900',
        active && 'bg-ink-100 text-ink-900',
      )}
    >
      <Icon size={15} />
    </button>
  );
}

const Divider = () => <span className="mx-1 h-4 w-px bg-ink-200" />;

function ToolMenu({ trigger, label, children }: { trigger: ReactNode; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-0.5 rounded-md px-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
      >
        {trigger}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-ink-100 bg-white p-1 shadow-pop"
          onClick={close}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const menuItem =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-50';

function FontSizeMenu({ onPick }: { onPick: (size: string) => void }) {
  const sizes = [
    { label: 'Small', value: '1', className: 'text-xs' },
    { label: 'Normal', value: '3', className: 'text-sm' },
    { label: 'Large', value: '5', className: 'text-lg' },
    { label: 'Huge', value: '6', className: 'text-2xl' },
  ];
  return (
    <ToolMenu
      label="Text size"
      trigger={
        <>
          <span className="text-sm font-medium tracking-tight">
            T<span className="text-xs">T</span>
          </span>
          <ChevronsUpDown size={11} />
        </>
      }
    >
      {sizes.map((s) => (
        <button key={s.value} type="button" className={menuItem} onClick={() => onPick(s.value)}>
          <span className={s.className}>{s.label}</span>
        </button>
      ))}
    </ToolMenu>
  );
}

function AlignMenu({ onPick }: { onPick: (command: string) => void }) {
  const options = [
    { label: 'Left', command: 'justifyLeft', icon: AlignLeft },
    { label: 'Center', command: 'justifyCenter', icon: AlignCenter },
    { label: 'Right', command: 'justifyRight', icon: AlignRight },
  ];
  return (
    <ToolMenu
      label="Alignment"
      trigger={
        <>
          <AlignCenter size={15} />
          <ChevronsUpDown size={11} />
        </>
      }
    >
      {options.map((o) => (
        <button key={o.command} type="button" className={menuItem} onClick={() => onPick(o.command)}>
          <o.icon size={14} /> {o.label}
        </button>
      ))}
    </ToolMenu>
  );
}

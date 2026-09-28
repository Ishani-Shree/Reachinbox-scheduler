import { Upload, X } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import toast from 'react-hot-toast';
import { pluralize } from '../../utils/format';
import { extractEmails, isValidEmail } from '../../utils/leads';

const VISIBLE_CHIPS = 3;

interface RecipientsFieldProps {
  value: string[];
  onChange: (emails: string[]) => void;
}

/** "To" field: type/paste addresses, or upload a CSV/TXT lead list. */
export function RecipientsField({ value, onChange }: RecipientsFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const merge = (incoming: string[]) => {
    const merged = [...new Set([...value, ...incoming])];
    onChange(merged);
    return merged.length - value.length;
  };

  const commitDraft = () => {
    const found = extractEmails(draft);
    if (found.length) merge(found);
    else if (draft.trim() && !isValidEmail(draft)) toast.error(`"${draft.trim()}" is not a valid email`);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key) && draft.trim()) {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('File is too large (max 5 MB)');
    const found = extractEmails(await file.text());
    if (!found.length) return toast.error(`No email addresses found in ${file.name}`);
    const added = merge(found);
    setFileName(file.name);
    toast.success(`${pluralize(found.length, 'email')} detected in ${file.name} (${added} new)`);
    if (fileRef.current) fileRef.current.value = '';
  };

  const hidden = value.length - VISIBLE_CHIPS;

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-ink-200 py-1.5 focus-within:border-brand-500">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {value.slice(0, VISIBLE_CHIPS).map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700"
            >
              {email}
              <button aria-label={`Remove ${email}`} onClick={() => onChange(value.filter((v) => v !== email))}>
                <X size={12} />
              </button>
            </span>
          ))}
          {hidden > 0 && (
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700">
              +{hidden.toLocaleString()}
            </span>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={commitDraft}
            onPaste={(e) => {
              const found = extractEmails(e.clipboardData.getData('text'));
              if (found.length > 1) {
                e.preventDefault();
                merge(found);
              }
            }}
            placeholder={value.length ? '' : 'recipient@example.com'}
            className="min-w-[160px] flex-1 border-0 bg-transparent py-1 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-0"
          />
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <Upload size={16} /> Upload List
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {value.length > 0 && (
        <div className="mt-1.5 flex items-center justify-between text-xs text-ink-500">
          <span>
            <span className="font-semibold text-brand-600">{pluralize(value.length, 'email address')}</span> detected
            {fileName && <> · from {fileName}</>}
          </span>
          <button className="hover:text-red-600" onClick={() => (onChange([]), setFileName(null))}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

import { FileText, Paperclip, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { formatBytes } from '../../utils/format';

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Paperclip button with a count badge (header of the compose page). */
export function AttachButton({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (picked: FileList | null) => {
    if (!picked?.length) return;
    const next = [...files, ...Array.from(picked)];
    if (next.length > MAX_ATTACHMENTS) return toast.error(`You can attach up to ${MAX_ATTACHMENTS} files`);
    if (next.reduce((sum, f) => sum + f.size, 0) > MAX_ATTACHMENT_BYTES) {
      return toast.error('Attachments can be at most 10 MB in total');
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <button
        type="button"
        title="Attach files"
        aria-label="Attach files"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-ink-100',
          files.length ? 'text-brand-600' : 'text-ink-500',
        )}
      >
        <Paperclip size={18} />
        {files.length > 0 && (
          <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold leading-none">{files.length}</span>
        )}
      </button>
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => add(e.target.files)} />
    </>
  );
}

function AttachmentThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/');
  const url = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  return (
    <div className="group relative w-36 overflow-hidden rounded-lg bg-ink-50">
      {url ? (
        <img src={url} alt={file.name} className="h-20 w-full object-cover" />
      ) : (
        <div className="flex h-20 items-center justify-center text-ink-400">
          <FileText size={26} />
        </div>
      )}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-ink-900">{file.name}</p>
        <p className="text-[10px] text-ink-400">{formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}

/** Thumbnails shown under the editor. */
export function AttachmentList({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {files.map((file, i) => (
        <AttachmentThumb
          key={`${file.name}-${file.size}-${i}`}
          file={file}
          onRemove={() => onChange(files.filter((_, j) => j !== i))}
        />
      ))}
    </div>
  );
}

/** File -> base64 (without the data: prefix) for the JSON API. */
export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

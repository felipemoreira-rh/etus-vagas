import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'

interface FileUploadProps {
  label: string
  hint?: string
  accept?: string
  disabled?: boolean
  onFile: (file: File) => Promise<void> | void
}

/** Drag & drop + browse button. Chama onFile para cada arquivo. */
export default function FileUpload({
  label,
  hint = 'Arraste um arquivo aqui ou clique pra escolher (PDF, DOC, até 20MB).',
  accept,
  disabled,
  onFile,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handle(file: File) {
    setErr(null)
    setBusy(true)
    try {
      await onFile(file)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro no upload.')
    } finally {
      setBusy(false)
    }
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handle(f)
    e.target.value = ''
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDrag(false)
    if (disabled || busy) return
    const f = e.dataTransfer.files?.[0]
    if (f) handle(f)
  }

  return (
    <div>
      <div
        className={'upload-zone' + (drag ? ' drag' : '')}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !busy) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-disabled={disabled || busy}
        style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
      >
        <div className="up-ico">{busy ? '⏳' : '⇪'}</div>
        <div className="up-ttl">{busy ? 'Enviando…' : label}</div>
        <div className="up-sub">{hint}</div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onChange}
          disabled={disabled || busy}
        />
      </div>
      {err && <div className="error-text" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  )
}

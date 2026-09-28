import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type Choice = { label: string; value: string; danger?: boolean }

type Request =
  | { kind: 'prompt'; title: string; initial: string; okLabel: string; resolve: (v: string | null) => void }
  | { kind: 'confirm'; title: string; message: string; okLabel: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'choose'; title: string; choices: Choice[]; resolve: (v: string | null) => void }

interface DialogApi {
  prompt: (title: string, initial?: string, okLabel?: string) => Promise<string | null>
  confirm: (title: string, message: string, opts?: { okLabel?: string; danger?: boolean }) => Promise<boolean>
  choose: (title: string, choices: Choice[]) => Promise<string | null>
}

const DialogContext = createContext<DialogApi | null>(null)

export function useDialog() {
  const api = useContext(DialogContext)
  if (!api) throw new Error('useDialog outside DialogProvider')
  return api
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null)

  const prompt = useCallback<DialogApi['prompt']>(
    (title, initial = '', okLabel = 'Save') =>
      new Promise((resolve) => setReq({ kind: 'prompt', title, initial, okLabel, resolve })),
    [],
  )
  const confirm = useCallback<DialogApi['confirm']>(
    (title, message, opts) =>
      new Promise((resolve) =>
        setReq({ kind: 'confirm', title, message, okLabel: opts?.okLabel ?? 'OK', danger: !!opts?.danger, resolve }),
      ),
    [],
  )
  const choose = useCallback<DialogApi['choose']>(
    (title, choices) => new Promise((resolve) => setReq({ kind: 'choose', title, choices, resolve })),
    [],
  )

  const [api] = useState<DialogApi>(() => ({ prompt, confirm, choose }))

  return (
    <DialogContext.Provider value={api}>
      {children}
      {req && <DialogView req={req} close={() => setReq(null)} />}
    </DialogContext.Provider>
  )
}

function DialogView({ req, close }: { req: Request; close: () => void }) {
  const [value, setValue] = useState(req.kind === 'prompt' ? req.initial : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (req.kind === 'prompt') inputRef.current?.select()
  }, [req])

  const cancel = () => {
    if (req.kind === 'confirm') req.resolve(false)
    else req.resolve(null)
    close()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="dialog-backdrop" onClick={cancel}>
      <div className={`dialog ${req.kind === 'choose' ? 'dialog-sheet' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={req.title}>
        <h2 className="dialog-title">{req.title}</h2>
        {req.kind === 'prompt' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              req.resolve(value.trim() || null)
              close()
            }}
          >
            <input ref={inputRef} className="input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={cancel}>Cancel</button>
              <button type="submit" className="btn btn-primary">{req.okLabel}</button>
            </div>
          </form>
        )}
        {req.kind === 'confirm' && (
          <>
            <p className="dialog-message">{req.message}</p>
            <div className="dialog-actions">
              <button className="btn" onClick={cancel}>Cancel</button>
              <button
                className={`btn ${req.danger ? 'btn-danger' : 'btn-primary'}`}
                autoFocus
                onClick={() => {
                  req.resolve(true)
                  close()
                }}
              >
                {req.okLabel}
              </button>
            </div>
          </>
        )}
        {req.kind === 'choose' && (
          <div className="sheet-list">
            {req.choices.map((c) => (
              <button
                key={c.value}
                className={`sheet-item ${c.danger ? 'danger' : ''}`}
                onClick={() => {
                  req.resolve(c.value)
                  close()
                }}
              >
                {c.label}
              </button>
            ))}
            <button className="sheet-item sheet-cancel" onClick={cancel}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

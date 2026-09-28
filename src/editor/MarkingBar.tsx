import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { useDialog } from '../components/Dialog'
import { getPendingXref, linkXref, onPendingXref, setPendingXref, type PendingXref } from '../lib/xrefs'
import {
  addAttrMark,
  newId,
  removeAllMarks,
  toggleInlineAtom,
  toggleMarginLine,
  toggleSpanMark,
  updateMarkById,
  type Range,
} from './marking'

/** The current text selection inside the editor, read from the DOM (the editor is read-only in Mark mode). */
function readSelection(editor: Editor): Range | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const r = sel.getRangeAt(0)
  const root = editor.view.dom
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null
  try {
    const from = editor.view.posAtDOM(r.startContainer, r.startOffset)
    const to = editor.view.posAtDOM(r.endContainer, r.endOffset)
    if (to <= from) return null
    return { from, to }
  } catch {
    return null
  }
}

function usePending() {
  const [pending, setPending] = useState<PendingXref | null>(getPendingXref)
  useEffect(() => onPendingXref(() => setPending(getPendingXref())), [])
  return pending
}

const GUIDE: { glyph: ReactNode; name: string; job: string; how: string }[] = [
  { glyph: <span className="mk-key">U</span>, name: 'Underline', job: 'The key idea in a sentence.', how: 'Select the words that carry the idea.' },
  { glyph: <span className="glyph-line" />, name: 'Line', job: 'Marks a long passage without underlining all of it.', how: 'Select anywhere in the paragraphs.' },
  { glyph: <span className="mk-star">★</span>, name: 'Star', job: 'A very important idea. Only 10–20 per book.', how: 'Select the idea; the star goes after it.' },
  { glyph: <span className="glyph-step">1</span>, name: 'Number', job: 'Steps in an argument. They count 1, 2, 3 on their own.', how: 'Select each step in turn.' },
  { glyph: <span className="mk-xref-glyph">cf.</span>, name: 'cf.', job: 'Links two ideas, on this page or another.', how: 'Tap cf. on the first passage, then on the second.' },
  { glyph: <span className="mk-circled glyph-circled">ab</span>, name: 'Circle', job: 'Key vocabulary and terms.', how: 'Select the word.' },
  { glyph: <span className="handwriting glyph-note">note</span>, name: 'Note', job: 'Your own summary, question or reaction, in the margin.', how: 'Select the passage, then write.' },
]

const GUIDE_AUTO = 'nb:guide-auto'
const guideAuto = () => {
  try {
    return localStorage.getItem(GUIDE_AUTO) !== 'off'
  } catch {
    return true
  }
}

export function MarkingGuide({ close }: { close: () => void }) {
  const [auto, setAuto] = useState(guideAuto)
  return (
    <aside className="guide" role="dialog" aria-label="Marking tools guide">
      <div className="guide-head">
        <div>
          <div className="guide-kicker">Mark mode</div>
          <h2 className="guide-title">Adler’s 7 marking tools</h2>
        </div>
        <button className="icon-btn" onClick={close} aria-label="Close guide">
          ✕
        </button>
      </div>
      <p className="guide-intro">
        Long-press or drag to select text, then tap a tool. Tap the same tool again to remove it.
      </p>
      <ol className="guide-list">
        {GUIDE.map((g) => (
          <li key={g.name}>
            <span className="guide-glyph">{g.glyph}</span>
            <span className="guide-text">
              <b>{g.name}</b> — {g.job}
              <span className="guide-how">{g.how}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="guide-foot">
        <label className="guide-auto">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked)
              try {
                localStorage.setItem(GUIDE_AUTO, e.target.checked ? 'on' : 'off')
              } catch {
                /* ignore */
              }
            }}
          />
          Show when I tap the pen
        </label>
        <button className="btn btn-primary" onClick={close}>
          Got it
        </button>
      </div>
    </aside>
  )
}

function Tool({ label, children, onUse, disabled }: { label: string; children: ReactNode; onUse: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      className="mark-tool"
      aria-label={label}
      title={label}
      disabled={disabled}
      // Stop the tap from clearing the text selection before we read it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onUse}
    >
      <span className="mark-tool-glyph">{children}</span>
      <span className="mark-tool-label">{label}</span>
    </button>
  )
}

export function MarkingBar({ editor, pageId }: { editor: Editor; pageId: string }) {
  const dialog = useDialog()
  const [showGuide, setShowGuide] = useState(guideAuto)
  const pending = usePending()
  const [hasSelection, setHasSelection] = useState(false)
  const last = useRef<Range | null>(null)

  useEffect(() => {
    let clearTimer: number | undefined
    const onChange = () => {
      const r = readSelection(editor)
      if (r) {
        window.clearTimeout(clearTimer)
        last.current = r
        setHasSelection(true)
      } else {
        // iOS collapses the selection when a toolbar button is tapped; keep the last range briefly.
        clearTimer = window.setTimeout(() => {
          last.current = null
          setHasSelection(false)
        }, 400)
      }
    }
    document.addEventListener('selectionchange', onChange)
    return () => {
      document.removeEventListener('selectionchange', onChange)
      window.clearTimeout(clearTimer)
    }
  }, [editor])

  const take = useCallback((): Range | null => {
    const r = readSelection(editor) ?? last.current
    return r
  }, [editor])

  const done = () => {
    window.getSelection()?.removeAllRanges()
    last.current = null
    setHasSelection(false)
  }

  const quoteOf = (r: Range) => editor.state.doc.textBetween(r.from, r.to, ' ').trim()

  const use = (fn: (r: Range) => void | Promise<void>) => async () => {
    const r = take()
    if (!r) return
    await fn(r)
    done()
  }

  const addNote = use(async (r) => {
    const quote = quoteOf(r)
    const res = await dialog.note({ title: 'Margin note', quote })
    if (res && 'text' in res && res.text) addAttrMark(editor, r, 'marginNote', { id: newId(), text: res.text })
  })

  const addXref = use(async (r) => {
    const quote = quoteOf(r)
    const ref = newId()
    addAttrMark(editor, r, 'crossRef', { ref })
    const p = getPendingXref()
    if (p && p.ref !== ref) {
      try {
        await linkXref(p, { pageId, ref, quote })
        setPendingXref(null)
      } catch (e) {
        alert(`Couldn’t save the link: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      setPendingXref({ ref, pageId, quote })
    }
  })

  const cancelPending = () => {
    if (pending && pending.pageId === pageId) updateMarkById(editor, 'crossRef', 'ref', pending.ref, null)
    setPendingXref(null)
  }

  const dis = !hasSelection
  return (
    <>
    {showGuide && (
      <>
        <div className="guide-backdrop" onClick={() => setShowGuide(false)} />
        <MarkingGuide close={() => setShowGuide(false)} />
      </>
    )}
    <div className="marking-bar-wrap" role="toolbar" aria-label="Marking tools">
      {pending && (
        <div className="xref-banner">
          <span className="xref-banner-text">
            <b>Linking</b> “{pending.quote.slice(0, 60)}
            {pending.quote.length > 60 ? '…' : ''}” — select the other passage (on any page) and tap <b>cf.</b>
          </span>
          <button className="chip" onClick={cancelPending}>
            Cancel
          </button>
        </div>
      )}
      <div className="marking-bar">
        <div className="marking-tools">
          <Tool label="Underline" disabled={dis} onUse={use((r) => toggleSpanMark(editor, r, 'keyUnderline'))}>
            <span className="mk-key">U</span>
          </Tool>
          <Tool label="Line" disabled={dis} onUse={use((r) => toggleMarginLine(editor, r))}>
            <span className="glyph-line" />
          </Tool>
          <Tool label="Star" disabled={dis} onUse={use((r) => toggleInlineAtom(editor, r, 'star'))}>
            <span className="mk-star">★</span>
          </Tool>
          <Tool label="Number" disabled={dis} onUse={use((r) => toggleInlineAtom(editor, r, 'stepNumber'))}>
            <span className="glyph-step">1</span>
          </Tool>
          <Tool label={pending ? 'Link here' : 'cf.'} disabled={dis} onUse={addXref}>
            <span className="mk-xref-glyph">cf.</span>
          </Tool>
          <Tool label="Circle" disabled={dis} onUse={use((r) => toggleSpanMark(editor, r, 'circled'))}>
            <span className="mk-circled glyph-circled">ab</span>
          </Tool>
          <Tool label="Note" disabled={dis} onUse={addNote}>
            <span className="handwriting glyph-note">note</span>
          </Tool>
        </div>
        <div className="marking-extra">
          <button
            className="mark-mini"
            disabled={dis}
            onMouseDown={(e) => e.preventDefault()}
            onClick={use((r) => removeAllMarks(editor, r))}
            aria-label="Clear marks from selection"
            title="Clear marks from selection"
          >
            Clear
          </button>
          <button className={`mark-mini ${showGuide ? 'on' : ''}`} onClick={() => setShowGuide((v) => !v)} aria-label="Key to the markings" aria-pressed={showGuide} title="What each tool does">
            Key
          </button>
        </div>
      </div>
      {!hasSelection && !pending && !showGuide && <div className="marking-hint">Long-press or drag to select text, then pick a mark.</div>}
    </div>
    </>
  )
}

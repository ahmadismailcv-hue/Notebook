import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { useDialog } from '../components/Dialog'
import { usePopover } from '../components/Popover'
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

export function MarkingKey() {
  return (
    <div className="marking-key">
      <div className="menu-title">Key to the markings</div>
      <dl>
        <div><dt><span className="mk-key">Underline</span></dt><dd>the key idea in a sentence.</dd></div>
        <div><dt><span className="key-line">Vertical line</span></dt><dd>marks a long passage without underlining all of it.</dd></div>
        <div><dt><span className="mk-star">★</span> Star</dt><dd>a very important idea (only 10–20 per book).</dd></div>
        <div><dt><span className="mk-step key-step">1</span> Numbers</dt><dd>show steps in an argument.</dd></div>
        <div><dt><span className="mk-xref">cf.</span> Cross-reference</dt><dd>links ideas across pages.</dd></div>
        <div><dt><span className="mk-circled">term</span> Circled term</dt><dd>key vocabulary.</dd></div>
        <div><dt><span className="handwriting">handwritten note</span></dt><dd>Margin note: your own summaries, questions, reactions.</dd></div>
      </dl>
    </div>
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
  const popover = usePopover()
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
          <button className="mark-mini" onClick={(e) => popover.open(e.currentTarget, () => <MarkingKey />, 'top-end')} aria-label="Key to the markings" title="Key to the markings">
            Key
          </button>
        </div>
      </div>
      {!hasSelection && !pending && <div className="marking-hint">Long-press or drag to select text, then pick a mark.</div>}
    </div>
  )
}

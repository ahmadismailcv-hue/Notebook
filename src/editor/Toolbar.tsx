import { useEffect, useState, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'

// On iPhone the toolbar sits directly above the on-screen keyboard. iOS doesn't resize the layout
// viewport for the keyboard, so we track the visual viewport and lift the toolbar by the difference.
function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

function Btn({ onClick, active, label, children, disabled }: { onClick: () => void; active?: boolean; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // Keep the text selection and the keyboard: don't let the button take focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage: () => void; uploading: boolean }) {
  const inset = useKeyboardInset()
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      highlight: e.isActive('highlight'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const c = () => editor.chain().focus()

  return (
    <div className="toolbar" style={{ '--kb-inset': `${inset}px` } as React.CSSProperties} role="toolbar" aria-label="Formatting">
      <div className="toolbar-scroll">
        <Btn label="Heading 1" active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>H3</Btn>
        <span className="tb-sep" />
        <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
        <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}><i style={{ fontFamily: 'Georgia, serif' }}>I</i></Btn>
        <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
        <Btn label="Highlight" active={s.highlight} onClick={() => c().toggleHighlight().run()}>
          <span className="tb-highlight">A</span>
        </Btn>
        <span className="tb-sep" />
        <Btn label="Bullet list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="6" r="1.6" /><circle cx="5" cy="12" r="1.6" /><circle cx="5" cy="18" r="1.6" /><rect x="9" y="5" width="11" height="2" rx="1" /><rect x="9" y="11" width="11" height="2" rx="1" /><rect x="9" y="17" width="11" height="2" rx="1" /></g></svg>
        </Btn>
        <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><text x="2" y="8.5" fontSize="7" fontFamily="system-ui">1</text><text x="2" y="14.5" fontSize="7" fontFamily="system-ui">2</text><text x="2" y="20.5" fontSize="7" fontFamily="system-ui">3</text><rect x="9" y="5" width="11" height="2" rx="1" /><rect x="9" y="11" width="11" height="2" rx="1" /><rect x="9" y="17" width="11" height="2" rx="1" /></g></svg>
        </Btn>
        <Btn label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 7h4v4H8.5c0 1.8.8 3 2.5 3.5V17c-3-.4-4-2.8-4-6V7Zm7 0h4v4h-2.5c0 1.8.8 3 2.5 3.5V17c-3-.4-4-2.8-4-6V7Z" /></svg>
        </Btn>
        <Btn label="Insert image" onClick={onImage} disabled={uploading}>
          {uploading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" d="M4 5h16v14H4z" /><circle cx="9" cy="10" r="1.8" fill="currentColor" /><path fill="currentColor" d="m5 18 5-5 3 3 2-2 4 4z" /></svg>
          )}
        </Btn>
        <span className="tb-sep" />
        <Btn label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M9 8H15a4.5 4.5 0 0 1 0 9H10M9 8l3-3M9 8l3 3" /></svg>
        </Btn>
        <Btn label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15 8H9a4.5 4.5 0 0 0 0 9h5M15 8l-3-3M15 8l-3 3" /></svg>
        </Btn>
      </div>
    </div>
  )
}

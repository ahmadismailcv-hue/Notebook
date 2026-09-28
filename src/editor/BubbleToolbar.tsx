import { useCallback, useMemo, useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { BLOCKS } from './blocks'
import { useDialog } from '../components/Dialog'

export const HIGHLIGHTS = [
  { name: 'Yellow', value: 'var(--hl-yellow)' },
  { name: 'Orange', value: 'var(--hl-orange)' },
  { name: 'Green', value: 'var(--hl-green)' },
  { name: 'Blue', value: 'var(--hl-blue)' },
  { name: 'Purple', value: 'var(--hl-purple)' },
  { name: 'Pink', value: 'var(--hl-pink)' },
]

const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

// Desktop selection toolbar. On touch screens the keyboard toolbar does this job, because a floating bar
// would collide with the iOS copy/paste callout.
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const dialog = useDialog()
  const [panel, setPanel] = useState<'turn' | 'color' | null>(null)
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      highlight: e.isActive('highlight'),
      block: BLOCKS.find((b) => b.isActive?.(e))?.title ?? 'Text',
    }),
  })
  // Stable references matter: BubbleMenu re-registers its editor plugin whenever these change,
  // and re-registering resets every other plugin view (the slash menu included).
  const options = useMemo(() => ({ placement: 'top' as const, offset: 8, onHide: () => setPanel(null) }), [])
  const shouldShow = useCallback(({ editor: e, state }: { editor: Editor; state: Editor['state'] }) => {
    const { empty, from, to } = state.selection
    if (empty || !canHover() || !e.isEditable || e.isActive('codeBlock') || e.isActive('image')) return false
    return state.doc.textBetween(from, to, ' ').trim().length > 0
  }, [])
  const c = () => editor.chain().focus()
  const keep = (e: React.MouseEvent) => e.preventDefault()

  return (
    <BubbleMenu
      editor={editor}
      options={options}
      shouldShow={shouldShow}
      className="bubble"
    >
      <div className="bubble-row">
        <button className="bubble-btn bubble-turn" onMouseDown={keep} onClick={() => setPanel(panel === 'turn' ? null : 'turn')}>
          {s.block} <span className="caret">▾</span>
        </button>
        <span className="bubble-sep" />
        <button className={`bubble-btn ${s.bold ? 'on' : ''}`} onMouseDown={keep} onClick={() => c().toggleBold().run()} aria-label="Bold" title="Bold ⌘B">
          <b>B</b>
        </button>
        <button className={`bubble-btn ${s.italic ? 'on' : ''}`} onMouseDown={keep} onClick={() => c().toggleItalic().run()} aria-label="Italic" title="Italic ⌘I">
          <i className="serif-i">i</i>
        </button>
        <button className={`bubble-btn ${s.underline ? 'on' : ''}`} onMouseDown={keep} onClick={() => c().toggleUnderline().run()} aria-label="Underline" title="Underline ⌘U">
          <u>U</u>
        </button>
        <button className={`bubble-btn ${s.strike ? 'on' : ''}`} onMouseDown={keep} onClick={() => c().toggleStrike().run()} aria-label="Strikethrough" title="Strikethrough">
          <s>S</s>
        </button>
        <button className={`bubble-btn ${s.code ? 'on' : ''}`} onMouseDown={keep} onClick={() => c().toggleCode().run()} aria-label="Inline code" title="Code">
          <span className="mono">{'</>'}</span>
        </button>
        <button
          className={`bubble-btn ${s.link ? 'on' : ''}`}
          onMouseDown={keep}
          aria-label="Link"
          title="Link"
          onClick={async () => {
            if (s.link) return void c().unsetLink().run()
            const url = await dialog.prompt('Link to', 'https://', 'Add link')
            if (url) c().extendMarkRange('link').setLink({ href: /^https?:\/\//.test(url) ? url : `https://${url}` }).run()
          }}
        >
          🔗
        </button>
        <span className="bubble-sep" />
        <button className={`bubble-btn ${s.highlight ? 'on' : ''}`} onMouseDown={keep} onClick={() => setPanel(panel === 'color' ? null : 'color')} aria-label="Highlight colour" title="Highlight">
          <span className="hl-swatch">A</span> <span className="caret">▾</span>
        </button>
      </div>
      {panel === 'turn' && (
        <div className="bubble-panel">
          <div className="menu-title">Turn into</div>
          {BLOCKS.filter((b) => b.id !== 'divider').map((b) => (
            <button
              key={b.id}
              className={`menu-item ${b.title === s.block ? 'checked' : ''}`}
              onMouseDown={keep}
              onClick={() => {
                b.apply(editor)
                setPanel(null)
              }}
            >
              <span className="menu-icon glyph">{b.glyph}</span>
              <span className="menu-label">{b.title}</span>
              {b.title === s.block && <span className="menu-hint">✓</span>}
            </button>
          ))}
        </div>
      )}
      {panel === 'color' && (
        <div className="bubble-panel">
          <div className="menu-title">Highlight</div>
          {HIGHLIGHTS.map((h) => (
            <button
              key={h.name}
              className="menu-item"
              onMouseDown={keep}
              onClick={() => {
                c().setHighlight({ color: h.value }).run()
                setPanel(null)
              }}
            >
              <span className="menu-icon">
                <span className="swatch" style={{ background: h.value }} />
              </span>
              <span className="menu-label">{h.name}</span>
            </button>
          ))}
          <button
            className="menu-item"
            onMouseDown={keep}
            onClick={() => {
              c().unsetHighlight().run()
              setPanel(null)
            }}
          >
            <span className="menu-icon">
              <span className="swatch swatch-none" />
            </span>
            <span className="menu-label">No highlight</span>
          </button>
        </div>
      )}
    </BubbleMenu>
  )
}

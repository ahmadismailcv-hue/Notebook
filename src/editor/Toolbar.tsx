import { useEffect, useState, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { BLOCKS } from './blocks'
import { HIGHLIGHTS } from './BubbleToolbar'
import { Menu, usePopover } from '../components/Popover'
import { Icon } from '../components/icons'

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

function Btn({ onClick, active, label, children, disabled }: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; active?: boolean; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text selection and the keyboard: don't let the button take focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Phone keyboard toolbar (Notion mobile style). Hidden on larger screens, where the bubble menu takes over. */
export function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage: () => void; uploading: boolean }) {
  const inset = useKeyboardInset()
  const popover = usePopover()
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      todo: e.isActive('taskList'),
      bullet: e.isActive('bulletList'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const c = () => editor.chain().focus()

  const openSlash = () => {
    const { $from } = editor.state.selection
    const chain = editor.chain().focus()
    if ($from.parent.textContent.length > 0) chain.setTextSelection($from.end()).splitBlock()
    chain.insertContent('/').run()
  }

  return (
    <div className="toolbar" style={{ '--kb-inset': `${inset}px` } as React.CSSProperties} role="toolbar" aria-label="Formatting">
      <div className="toolbar-scroll">
        <Btn label="Insert block" onClick={openSlash}>
          <Icon name="plus" />
        </Btn>
        <Btn
          label="Turn into"
          onClick={(e) =>
            popover.open(e.currentTarget, (close) => (
              <Menu
                close={close}
                title="Turn into"
                items={BLOCKS.filter((b) => b.id !== 'divider').map((b) => ({
                  label: b.title,
                  icon: <span className="glyph">{b.glyph}</span>,
                  hint: b.isActive?.(editor) ? '✓' : undefined,
                  onSelect: () => b.apply(editor),
                }))}
              />
            ), 'top-start')
          }
        >
          <span className="tb-text">Aa</span>
        </Btn>
        <span className="tb-sep" />
        <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
          <b className="tb-text">B</b>
        </Btn>
        <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
          <i className="tb-text serif-i">i</i>
        </Btn>
        <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}>
          <u className="tb-text">U</u>
        </Btn>
        <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}>
          <s className="tb-text">S</s>
        </Btn>
        <Btn label="Highlight" active={s.highlight} onClick={() => (s.highlight ? c().unsetHighlight().run() : c().setHighlight({ color: HIGHLIGHTS[0].value }).run())}>
          <span className="hl-swatch">A</span>
        </Btn>
        <span className="tb-sep" />
        <Btn label="To-do" active={s.todo} onClick={() => c().toggleTaskList().run()}>
          <Icon name="check" />
        </Btn>
        <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
          <span className="tb-text">•</span>
        </Btn>
        <Btn label="Insert image" onClick={onImage} disabled={uploading}>
          {uploading ? <span className="spinner" aria-hidden="true" /> : <Icon name="image" />}
        </Btn>
        <span className="tb-sep" />
        <Btn label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}>
          <Icon name="undo" />
        </Btn>
        <Btn label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}>
          <Icon name="redo" />
        </Btn>
        <Btn label="Hide keyboard" onClick={() => editor.commands.blur()}>
          <Icon name="keyboardHide" />
        </Btn>
      </div>
    </div>
  )
}

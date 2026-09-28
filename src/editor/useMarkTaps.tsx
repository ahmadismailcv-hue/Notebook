import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { useNavigate } from 'react-router-dom'
import { useDialog } from '../components/Dialog'
import { Menu, usePopover } from '../components/Popover'
import { Icon } from '../components/icons'
import { deleteXref, findXrefTargets, setPendingXref } from '../lib/xrefs'
import { findMarkText, updateMarkById } from './marking'

const noteText = (editor: Editor, id: string) => {
  let text = ''
  editor.state.doc.descendants((n) => {
    const m = n.marks.find((x) => x.type.name === 'marginNote' && x.attrs.id === id)
    if (m) text = m.attrs.text as string
  })
  return text
}

/** Taps on existing marks: open a note, follow a cross-reference, remove a star or number. */
export function useMarkTaps(editor: Editor | null, pageId: string, marking: boolean) {
  const dialog = useDialog()
  const popover = usePopover()
  const navigate = useNavigate()
  const markingRef = useRef(marking)
  markingRef.current = marking

  useEffect(() => {
    if (!editor) return
    const root = editor.view.dom

    const editNote = async (id: string) => {
      const res = await dialog.note({ title: 'Margin note', quote: findMarkText(editor, 'marginNote', 'id', id), initial: noteText(editor, id), canDelete: true })
      if (!res) return
      if ('delete' in res) updateMarkById(editor, 'marginNote', 'id', id, null)
      else if (res.text) updateMarkById(editor, 'marginNote', 'id', id, { text: res.text })
    }

    const openXref = async (anchor: HTMLElement, ref: string) => {
      let targets: Awaited<ReturnType<typeof findXrefTargets>> = []
      try {
        targets = await findXrefTargets(ref)
      } catch (e) {
        alert(`Couldn’t load the link: ${e instanceof Error ? e.message : String(e)}`)
        return
      }
      const go = (t: (typeof targets)[number]) => {
        if (t.pageId === pageId) {
          const el = root.querySelector<HTMLElement>(`[data-xref="${CSS.escape(t.ref)}"]`)
          if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' })
            el.classList.add('flash')
            window.setTimeout(() => el.classList.remove('flash'), 2200)
          }
        } else navigate(`/p/${t.pageId}?ref=${encodeURIComponent(t.ref)}`)
      }
      const remove = () => {
        void deleteXref(ref).catch(() => {})
        updateMarkById(editor, 'crossRef', 'ref', ref, null)
      }
      if (targets.length === 1 && !markingRef.current) return go(targets[0])
      popover.open(anchor, (close) => (
        <Menu
          close={close}
          title={targets.length ? 'Cross-reference' : 'Not linked yet'}
          items={[
            ...targets.map((t) => ({
              label: `“${t.quote.slice(0, 48)}${t.quote.length > 48 ? '…' : ''}”`,
              icon: <span className="glyph">cf.</span>,
              hint: t.pageId === pageId ? 'this page' : '→',
              onSelect: () => go(t),
            })),
            {
              label: targets.length ? 'Link to another passage too' : 'Link to a passage…',
              icon: <Icon name="plus" />,
              onSelect: () => setPendingXref({ ref, pageId, quote: findMarkText(editor, 'crossRef', 'ref', ref) }),
            },
            'divider',
            { label: 'Remove cross-reference', icon: <Icon name="trash" />, danger: true, onSelect: remove },
          ]}
        />
      ))
    }

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      const widget = t.closest<HTMLElement>('[data-note-ref]')
      if (widget) {
        e.preventDefault()
        void editNote(widget.dataset.noteRef!)
        return
      }
      // In writing mode taps place the cursor; marks only react in Mark mode (or ⌘/Ctrl-click).
      if (!markingRef.current && !(e.metaKey || e.ctrlKey)) return
      if (window.getSelection()?.isCollapsed === false) return
      const xref = t.closest<HTMLElement>('[data-xref]')
      if (xref) {
        e.preventDefault()
        void openXref(xref, xref.dataset.xref!)
        return
      }
      const note = t.closest<HTMLElement>('[data-note-id]')
      if (note) {
        e.preventDefault()
        void editNote(note.dataset.noteId!)
        return
      }
      const atom = t.closest<HTMLElement>('[data-mark="star"], [data-mark="step"]')
      if (atom && markingRef.current) {
        const pos = editor.view.posAtDOM(atom, 0)
        const node = editor.state.doc.nodeAt(pos)
        if (!node || (node.type.name !== 'star' && node.type.name !== 'stepNumber')) return
        popover.open(atom, (close) => (
          <Menu
            close={close}
            items={[
              {
                label: node.type.name === 'star' ? 'Remove star' : 'Remove number',
                icon: <Icon name="trash" />,
                danger: true,
                onSelect: () => editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize)),
              },
            ]}
          />
        ))
      }
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [editor, pageId, dialog, popover, navigate])
}

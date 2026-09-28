import { Extension, Mark, Node, mergeAttributes, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

// Adler's marking tools. Everything lives in the page content, so marks move with the text
// and are saved (and protected against loss) by the same autosave as the words themselves.

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10)

/** Red underline: the key idea in a sentence. Separate from ordinary formatting underline. */
export const KeyUnderline = Mark.create({
  name: 'keyUnderline',
  parseHTML: () => [{ tag: 'span[data-mark="key"]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-mark': 'key', class: 'mk-key' }), 0],
})

/** Circled term: key vocabulary. */
export const CircledTerm = Mark.create({
  name: 'circled',
  parseHTML: () => [{ tag: 'span[data-mark="circled"]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-mark': 'circled', class: 'mk-circled' }), 0],
})

/** Margin note anchored to a passage. The note text is stored on the mark itself. */
export const MarginNote = Mark.create({
  name: 'marginNote',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute('data-note-id') },
      text: { default: '', parseHTML: (el) => el.getAttribute('data-note-text') ?? '' },
    }
  },
  parseHTML: () => [{ tag: 'span[data-note-id]' }],
  renderHTML: ({ HTMLAttributes, mark }) => [
    'span',
    mergeAttributes({ 'data-note-id': mark.attrs.id, 'data-note-text': mark.attrs.text, class: 'mk-note' }, HTMLAttributes.class ? { class: HTMLAttributes.class } : {}),
    0,
  ],
})

/** Cross-reference end. The pairing lives in the xrefs table, keyed by `ref`. */
export const CrossRef = Mark.create({
  name: 'crossRef',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return { ref: { default: null, parseHTML: (el) => el.getAttribute('data-xref') } }
  },
  parseHTML: () => [{ tag: 'span[data-xref]' }],
  renderHTML: ({ mark }) => ['span', { 'data-xref': mark.attrs.ref, class: 'mk-xref' }, 0],
})

/** Star: a very important idea. */
export const Star = Node.create({
  name: 'star',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'span[data-mark="star"]' }],
  renderHTML: () => ['span', { 'data-mark': 'star', class: 'mk-star', contenteditable: 'false' }, '★'],
  renderText: () => '★',
})

/** Numbered step in an argument. Numbering is automatic, in reading order (CSS counters). */
export const StepNumber = Node.create({
  name: 'stepNumber',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'span[data-mark="step"]' }],
  renderHTML: () => ['span', { 'data-mark': 'step', class: 'mk-step', contenteditable: 'false' }],
  renderText: () => '',
})

const LINE_TYPES = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'callout', 'codeBlock', 'image']

/** Vertical line in the margin beside a long passage (a block attribute). */
export const MarginLine = Extension.create({
  name: 'marginLine',
  addGlobalAttributes() {
    return [
      {
        types: LINE_TYPES,
        attributes: {
          marginLine: {
            default: false,
            parseHTML: (el) => el.getAttribute('data-margin-line') === 'true',
            renderHTML: (attrs) => (attrs.marginLine ? { 'data-margin-line': 'true' } : {}),
          },
        },
      },
    ]
  },
})

/** Renders note text in handwriting: in the right margin on wide screens, under the passage on phones. */
export const NoteWidgets = Extension.create({
  name: 'noteWidgets',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('noteWidgets'),
        props: {
          decorations: (state) => {
            const decos: Decoration[] = []
            state.doc.forEach((block, offset) => {
              const notes: { id: string; text: string }[] = []
              block.descendants((n) => {
                for (const m of n.marks) {
                  if (m.type.name === 'marginNote' && m.attrs.id && !notes.some((x) => x.id === m.attrs.id)) notes.push({ id: m.attrs.id, text: m.attrs.text })
                }
              })
              if (!notes.length) return
              const key = notes.map((n) => `${n.id}:${n.text}`).join('|')
              const make = (cls: string) => () => {
                const box = document.createElement('span')
                box.className = `note-widget ${cls}`
                box.contentEditable = 'false'
                for (const n of notes) {
                  const item = document.createElement('span')
                  item.className = 'note-widget-item'
                  item.dataset.noteRef = n.id
                  item.textContent = n.text || 'Empty note'
                  box.appendChild(item)
                }
                return box
              }
              decos.push(Decoration.widget(offset + block.nodeSize, make('note-below'), { side: -1, key: `below-${key}` }))
              decos.push(Decoration.widget(offset, make('note-margin'), { side: 1, key: `margin-${key}`, ignoreSelection: true }))
            })
            return DecorationSet.create(state.doc, decos)
          },
        },
      }),
    ]
  },
})

export const MARKING_EXTENSIONS = [KeyUnderline, CircledTerm, MarginNote, CrossRef, Star, StepNumber, MarginLine, NoteWidgets]

// ---------- Commands used by the marking bar ----------

export interface Range {
  from: number
  to: number
}

function rangeHasMark(editor: Editor, range: Range, name: string) {
  const type = editor.schema.marks[name]
  let all = true
  let any = false
  editor.state.doc.nodesBetween(range.from, range.to, (node) => {
    if (!node.isText) return
    if (type.isInSet(node.marks)) any = true
    else all = false
  })
  return any && all
}

export function toggleSpanMark(editor: Editor, range: Range, name: 'keyUnderline' | 'circled') {
  const type = editor.schema.marks[name]
  const tr = editor.state.tr
  if (rangeHasMark(editor, range, name)) tr.removeMark(range.from, range.to, type)
  else tr.addMark(range.from, range.to, type.create())
  editor.view.dispatch(tr)
}

export function addAttrMark(editor: Editor, range: Range, name: 'marginNote' | 'crossRef', attrs: Record<string, unknown>) {
  const tr = editor.state.tr.addMark(range.from, range.to, editor.schema.marks[name].create(attrs))
  editor.view.dispatch(tr)
}

/** Update or remove every piece of an attribute-mark (note / cross-ref) by its id. */
export function updateMarkById(editor: Editor, name: 'marginNote' | 'crossRef', key: 'id' | 'ref', id: string, attrs: Record<string, unknown> | null) {
  const type = editor.schema.marks[name]
  const tr = editor.state.tr
  editor.state.doc.descendants((node, pos) => {
    const m = node.marks.find((x) => x.type === type && x.attrs[key] === id)
    if (!m) return
    tr.removeMark(pos, pos + node.nodeSize, m)
    if (attrs) tr.addMark(pos, pos + node.nodeSize, type.create({ ...m.attrs, ...attrs }))
  })
  if (tr.docChanged) editor.view.dispatch(tr)
}

export function findMarkText(editor: Editor, name: 'marginNote' | 'crossRef', key: 'id' | 'ref', id: string) {
  let text = ''
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === name && m.attrs[key] === id)) text += node.text
  })
  return text
}

/** Star / number: remove any inside the selection, otherwise insert one. */
export function toggleInlineAtom(editor: Editor, range: Range, name: 'star' | 'stepNumber') {
  const found: { pos: number; size: number }[] = []
  editor.state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (node.type.name === name) found.push({ pos, size: node.nodeSize })
  })
  const tr = editor.state.tr
  if (found.length) {
    for (const f of found.reverse()) tr.delete(f.pos, f.pos + f.size)
  } else if (name === 'star') {
    tr.insert(range.to, editor.schema.nodes.star.create())
  } else {
    // A step number goes at the start of the block, before the argument it numbers.
    const $from = editor.state.doc.resolve(range.from)
    const at = $from.parent.isTextblock ? $from.start() : range.from
    tr.insert(at, editor.schema.nodes.stepNumber.create())
  }
  editor.view.dispatch(tr)
}

export function toggleMarginLine(editor: Editor, range: Range) {
  const blocks: { pos: number; node: PMNode }[] = []
  editor.state.doc.forEach((node, offset) => {
    const end = offset + node.nodeSize
    if (end > range.from && offset < range.to && LINE_TYPES.includes(node.type.name)) blocks.push({ pos: offset, node })
  })
  if (!blocks.length) return
  const on = !blocks.every((b) => b.node.attrs.marginLine)
  const tr = editor.state.tr
  for (const b of blocks) tr.setNodeMarkup(b.pos, undefined, { ...b.node.attrs, marginLine: on })
  editor.view.dispatch(tr)
}

export function removeAllMarks(editor: Editor, range: Range) {
  const s = editor.schema.marks
  const tr = editor.state.tr
  for (const name of ['keyUnderline', 'circled', 'marginNote', 'crossRef']) tr.removeMark(range.from, range.to, s[name])
  editor.view.dispatch(tr)
}

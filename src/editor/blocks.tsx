import type { Editor, Range } from '@tiptap/core'

export interface BlockType {
  id: string
  title: string
  description: string
  glyph: string
  keywords: string[]
  /** Convert the current block (used by the slash menu and "Turn into"). */
  apply: (editor: Editor, range?: Range) => void
  isActive?: (editor: Editor) => boolean
}

const start = (editor: Editor, range?: Range) => {
  const chain = editor.chain().focus()
  return range ? chain.deleteRange(range) : chain
}

export const BLOCKS: BlockType[] = [
  {
    id: 'text',
    title: 'Text',
    description: 'Just start writing with plain text.',
    glyph: 'Aa',
    keywords: ['paragraph', 'plain'],
    apply: (e, r) => start(e, r).setParagraph().run(),
    isActive: (e) => e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList') && !e.isActive('taskList') && !e.isActive('blockquote') && !e.isActive('callout'),
  },
  {
    id: 'h1',
    title: 'Heading 1',
    description: 'Big section heading.',
    glyph: 'H1',
    keywords: ['title', 'big', 'h1'],
    apply: (e, r) => start(e, r).setHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive('heading', { level: 1 }),
  },
  {
    id: 'h2',
    title: 'Heading 2',
    description: 'Medium section heading.',
    glyph: 'H2',
    keywords: ['subtitle', 'h2'],
    apply: (e, r) => start(e, r).setHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive('heading', { level: 2 }),
  },
  {
    id: 'h3',
    title: 'Heading 3',
    description: 'Small section heading.',
    glyph: 'H3',
    keywords: ['h3'],
    apply: (e, r) => start(e, r).setHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive('heading', { level: 3 }),
  },
  {
    id: 'todo',
    title: 'To-do list',
    description: 'Track tasks with a checkbox.',
    glyph: '☑',
    keywords: ['task', 'checkbox', 'check', 'todo'],
    apply: (e, r) => start(e, r).toggleTaskList().run(),
    isActive: (e) => e.isActive('taskList'),
  },
  {
    id: 'bullet',
    title: 'Bulleted list',
    description: 'Create a simple bulleted list.',
    glyph: '•',
    keywords: ['ul', 'unordered', 'list'],
    apply: (e, r) => start(e, r).toggleBulletList().run(),
    isActive: (e) => e.isActive('bulletList'),
  },
  {
    id: 'numbered',
    title: 'Numbered list',
    description: 'Create a list with numbering.',
    glyph: '1.',
    keywords: ['ol', 'ordered', 'list'],
    apply: (e, r) => start(e, r).toggleOrderedList().run(),
    isActive: (e) => e.isActive('orderedList'),
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Capture a quote.',
    glyph: '❝',
    keywords: ['blockquote', 'citation'],
    apply: (e, r) => start(e, r).setParagraph().toggleBlockquote().run(),
    isActive: (e) => e.isActive('blockquote'),
  },
  {
    id: 'callout',
    title: 'Callout',
    description: 'Make writing stand out.',
    glyph: '💡',
    keywords: ['note', 'info', 'tip', 'warning'],
    apply: (e, r) => start(e, r).setParagraph().setCallout().run(),
    isActive: (e) => e.isActive('callout'),
  },
  {
    id: 'code',
    title: 'Code',
    description: 'Capture a code snippet.',
    glyph: '</>',
    keywords: ['snippet', 'pre'],
    apply: (e, r) => start(e, r).toggleCodeBlock().run(),
    isActive: (e) => e.isActive('codeBlock'),
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Visually divide blocks.',
    glyph: '—',
    keywords: ['hr', 'line', 'separator', 'rule'],
    apply: (e, r) => start(e, r).setHorizontalRule().run(),
  },
]

export const IMAGE_BLOCK_ID = 'image'

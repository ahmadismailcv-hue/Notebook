import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'

const EMOJI = ['💡', '📌', '⚠️', '✅', '❗', '🔥', 'ℹ️', '💬']

function CalloutView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const emoji = (node.attrs.emoji as string) || '💡'
  return (
    <NodeViewWrapper className="callout" data-type="callout">
      <button
        className="callout-emoji"
        contentEditable={false}
        disabled={!editor.isEditable}
        aria-label="Change callout icon"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => updateAttributes({ emoji: EMOJI[(EMOJI.indexOf(emoji) + 1) % EMOJI.length] })}
      >
        {emoji}
      </button>
      <NodeViewContent className="callout-content" />
    </NodeViewWrapper>
  )
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: { setCallout: () => ReturnType }
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  addAttributes() {
    return { emoji: { default: '💡' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
    }
  },
  addKeyboardShortcuts() {
    return {
      // Enter on an empty last line leaves the callout, like Notion.
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection
        if (!empty || $from.depth < 2) return false
        const parent = $from.node(-1)
        if (parent.type.name !== this.name) return false
        const isLast = $from.index(-1) === parent.childCount - 1
        if (!isLast || $from.parent.content.size > 0) return false
        return editor.commands.lift(this.name)
      },
    }
  },
})

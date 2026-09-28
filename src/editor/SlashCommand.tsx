import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { BLOCKS } from './blocks'

export interface SlashItem {
  id: string
  title: string
  description: string
  glyph: string
  keywords: string[]
  run: (editor: Editor, range: Range) => void
}

type MenuProps = SuggestionProps<SlashItem, SlashItem>
export interface MenuHandle {
  onKeyDown: (p: SuggestionKeyDownProps) => boolean
}

const SlashMenu = forwardRef<MenuHandle, MenuProps>(function SlashMenu({ items, command, query }, ref) {
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => setIndex(0), [query])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        command(items[index])
        return true
      }
      return false
    },
  }))

  if (!items.length) return <div className="slash-menu slash-empty">No results</div>
  return (
    <div className="slash-menu" ref={listRef} role="listbox" aria-label="Insert block">
      <div className="slash-heading">Basic blocks</div>
      {items.map((item, i) => (
        <button
          key={item.id}
          data-index={i}
          role="option"
          aria-selected={i === index}
          className={`slash-item ${i === index ? 'selected' : ''}`}
          onMouseMove={() => i !== index && setIndex(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
        >
          <span className="slash-glyph">{item.glyph}</span>
          <span className="slash-text">
            <span className="slash-title">{item.title}</span>
            <span className="slash-desc">{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
})

export const SlashCommand = Extension.create<{ onImage: () => void }>({
  name: 'slashCommand',
  addOptions() {
    return { onImage: () => {} }
  },
  addProseMirrorPlugins() {
    const items: SlashItem[] = [
      ...BLOCKS.map((b) => ({ ...b, run: (e: Editor, r: Range) => b.apply(e, r) })),
      {
        id: 'image',
        title: 'Image',
        description: 'Upload from your device.',
        glyph: '🖼',
        keywords: ['photo', 'picture', 'upload'],
        run: (e: Editor, r: Range) => {
          e.chain().focus().deleteRange(r).run()
          this.options.onImage()
        },
      },
    ]
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommand'),
        char: '/',
        allowSpaces: false,
        // Not inside code blocks.
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => {
          const q = query.toLowerCase()
          return items.filter((i) => !q || i.title.toLowerCase().includes(q) || i.keywords.some((k) => k.startsWith(q)))
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<MenuHandle, MenuProps> | null = null
          const place = (props: MenuProps) => {
            const rect = props.clientRect?.()
            const el = renderer?.element as HTMLElement | undefined
            if (!rect || !el) return
            void computePosition({ getBoundingClientRect: () => rect }, el, {
              placement: 'bottom-start',
              strategy: 'fixed',
              middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
            }).then(({ x, y }) => Object.assign(el.style, { left: `${x}px`, top: `${y}px`, visibility: 'visible' }))
          }
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor })
              const el = renderer.element as HTMLElement
              Object.assign(el.style, { position: 'fixed', zIndex: '60', visibility: 'hidden', left: '0', top: '0' })
              document.body.appendChild(el)
              place(props)
            },
            onUpdate: (props) => {
              renderer?.updateProps(props)
              place(props)
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                renderer?.destroy()
                renderer?.element.remove()
                renderer = null
                return true
              }
              return renderer?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              renderer?.destroy()
              renderer?.element.remove()
              renderer = null
            },
          }
        },
      }),
    ]
  },
})

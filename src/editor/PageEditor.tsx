import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import DragHandle from '@tiptap/extension-drag-handle-react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { pickImage, uploadImage } from '../lib/images'
import type { Snapshot } from '../lib/pageSaver'
import { BANNER_PRESETS, bannerStyle } from '../lib/types'
import { EmojiPicker, ALL_EMOJI } from '../components/EmojiPicker'
import { Menu, usePopover } from '../components/Popover'
import { Icon } from '../components/icons'
import { BLOCKS } from './blocks'
import { BubbleToolbar } from './BubbleToolbar'
import { Callout } from './Callout'
import { SlashCommand } from './SlashCommand'
import { Toolbar } from './Toolbar'

interface Props {
  initial: Snapshot
  onChange: (snap: Snapshot) => void
}

// Stable plugin config: the drag handle re-registers its plugin when these props change.
const HANDLE_POSITION = { placement: 'left-start' as const, strategy: 'absolute' as const }

export const PageEditor = memo(function PageEditor({ initial, onChange }: Props) {
  const popover = usePopover()
  const [title, setTitle] = useState(initial.title)
  const [icon, setIcon] = useState(initial.icon)
  const [banner, setBanner] = useState(initial.banner_url)
  const [uploading, setUploading] = useState(0)
  const meta = useRef({ title: initial.title, icon: initial.icon, banner_url: initial.banner_url })
  const titleEl = useRef<HTMLTextAreaElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const editorRef = useRef<Editor | null>(null)
  const block = useRef<{ node: PMNode; pos: number } | null>(null)
  const onNodeChange = useCallback(({ node, pos }: { node: PMNode | null; pos: number }) => {
    block.current = node ? { node, pos } : null
  }, [])

  const emit = () => {
    const e = editorRef.current
    if (e) onChangeRef.current({ ...meta.current, content: e.getJSON() as JSONContent })
  }
  const setMeta = (patch: Partial<typeof meta.current>) => {
    meta.current = { ...meta.current, ...patch }
    emit()
  }

  const insertFiles = async (files: File[], pos?: number) => {
    const editor = editorRef.current
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length || !editor) return
    setUploading((n) => n + images.length)
    for (const file of images) {
      try {
        const src = await uploadImage(file)
        // Never replace selected text or split a paragraph: drop the image after the current block.
        const { $to } = editor.state.selection
        const at = pos ?? ($to.depth > 0 ? $to.after(1) : $to.pos)
        editor.chain().focus().insertContentAt(at, { type: 'image', attrs: { src } }).run()
      } catch (e) {
        alert(`Image upload failed: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }
  const insertFilesRef = useRef(insertFiles)
  insertFilesRef.current = insertFiles
  const chooseImage = async () => {
    const file = await pickImage()
    if (file) void insertFilesRef.current([file])
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      Image.configure({ allowBase64: false }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Callout,
      SlashCommand.configure({ onImage: () => void chooseImage() }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return `Heading ${node.attrs.level}`
          if (node.type.name === 'paragraph') return 'Write something, or type “/” for blocks…'
          return ''
        },
      }),
    ],
    content: initial.content,
    editorProps: {
      attributes: { class: 'prose', spellcheck: 'true' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (!files.some((f) => f.type.startsWith('image/'))) return false
        void insertFilesRef.current(files)
        return true
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (!files.some((f) => f.type.startsWith('image/'))) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        void insertFilesRef.current(files, pos)
        return true
      },
    },
    onUpdate: () => emit(),
  }, [])
  // ^ Build the editor once per page. Everything it calls reads through refs, so it never needs to be
  //   re-created; re-creating it on every render would tear down open menus mid-keystroke.
  editorRef.current = editor

  // Auto-grow the title field.
  useEffect(() => {
    const el = titleEl.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  // Empty new page: start in the title.
  useEffect(() => {
    if (!initial.title && editor?.isEmpty) titleEl.current?.focus()
  }, [editor, initial.title])

  if (!editor) return null

  const addBlockBelow = () => {
    const b = block.current
    if (!b) return
    const at = b.pos + b.node.nodeSize
    editor.chain().insertContentAt(at, { type: 'paragraph' }).setTextSelection(at + 1).focus().insertContent('/').run()
  }

  const blockMenu = (anchor: HTMLElement) => {
    const b = block.current
    if (!b) return
    const { node, pos } = b
    const turnInto = () =>
      popover.open(anchor, (close) => (
        <Menu
          close={close}
          title="Turn into"
          items={BLOCKS.filter((x) => x.id !== 'divider').map((x) => ({
            label: x.title,
            icon: <span className="glyph">{x.glyph}</span>,
            onSelect: () => {
              editor.chain().setTextSelection(pos + 1).run()
              x.apply(editor)
            },
          }))}
        />
      ))
    popover.open(
      anchor,
      (close) => (
        <Menu
          close={close}
          items={[
            ...(node.isTextblock || node.type.name.endsWith('List') || node.type.name === 'blockquote' || node.type.name === 'callout'
              ? [{ label: 'Turn into', icon: <span className="glyph">⇄</span>, onSelect: turnInto }]
              : []),
            { label: 'Duplicate', icon: <span className="glyph">⧉</span>, onSelect: () => void editor.chain().insertContentAt(pos + node.nodeSize, node.toJSON()).focus().run() },
            'divider',
            { label: 'Delete', icon: <Icon name="trash" />, danger: true, onSelect: () => void editor.chain().deleteRange({ from: pos, to: pos + node.nodeSize }).focus().run() },
          ]}
        />
      ),
      'left-start',
    )
  }

  const pickIcon = (anchor: HTMLElement) =>
    popover.open(anchor, (close) => (
      <EmojiPicker
        close={close}
        onPick={(e) => {
          setIcon(e)
          setMeta({ icon: e })
        }}
        onRemove={() => {
          setIcon(null)
          setMeta({ icon: null })
        }}
      />
    ))

  const changeBanner = (anchor: HTMLElement) =>
    popover.open(anchor, (close) => (
      <div className="banner-picker">
        <div className="menu-title">Cover</div>
        <div className="banner-grid">
          {BANNER_PRESETS.map((_, i) => (
            <button
              key={i}
              className="banner-swatch"
              style={bannerStyle(`preset:${i}`)}
              aria-label={`Gradient ${i + 1}`}
              onClick={() => {
                setBanner(`preset:${i}`)
                setMeta({ banner_url: `preset:${i}` })
                close()
              }}
            />
          ))}
        </div>
        <div className="banner-actions">
          <button
            className="chip"
            onClick={async () => {
              close()
              const file = await pickImage()
              if (!file) return
              setUploading((n) => n + 1)
              try {
                const url = await uploadImage(file)
                setBanner(url)
                setMeta({ banner_url: url })
              } catch (e) {
                alert(`Upload failed: ${e instanceof Error ? e.message : String(e)}`)
              } finally {
                setUploading((n) => n - 1)
              }
            }}
          >
            Upload image
          </button>
          {banner && (
            <button
              className="chip"
              onClick={() => {
                setBanner(null)
                setMeta({ banner_url: null })
                close()
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    ))

  return (
    <>
      {banner && (
        <div className="banner" style={bannerStyle(banner)}>
          <button className="banner-change" onClick={(e) => changeBanner(e.currentTarget)}>
            Change cover
          </button>
        </div>
      )}
      <article className={`doc page ${banner ? 'has-banner' : ''} ${icon ? 'has-icon' : ''}`}>
        {icon && (
          <button className="page-icon" onClick={(e) => pickIcon(e.currentTarget)} aria-label="Change icon">
            {icon}
          </button>
        )}
        {(!icon || !banner) && (
        <div className="page-controls">
          {!icon && (
            <button
              className="ghost-btn"
              onClick={() => {
                const e = ALL_EMOJI[Math.floor(Math.random() * 24)]
                setIcon(e)
                setMeta({ icon: e })
              }}
            >
              <Icon name="smile" size={16} /> Add icon
            </button>
          )}
          {!banner && (
            <button
              className="ghost-btn"
              onClick={() => {
                const b = `preset:${Math.floor(Math.random() * BANNER_PRESETS.length)}`
                setBanner(b)
                setMeta({ banner_url: b })
              }}
            >
              <Icon name="image" size={16} /> Add cover
            </button>
          )}
        </div>
        )}
        <textarea
          ref={titleEl}
          className="page-title"
          rows={1}
          placeholder="Untitled"
          value={title}
          onChange={(e) => {
            const v = e.target.value.replace(/\n/g, ' ')
            setTitle(v)
            setMeta({ title: v })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              // Focus synchronously: TipTap's focus command waits a frame, and fast typing would land in the title.
              editor.commands.setTextSelection(1)
              editor.view.focus()
            }
          }}
        />
        <DragHandle
          editor={editor}
          className="drag-handle"
          onNodeChange={onNodeChange}
          computePositionConfig={HANDLE_POSITION}
        >
          <div className="block-handle">
            <button className="handle-btn" aria-label="Add block below" onClick={addBlockBelow} onMouseDown={(e) => e.preventDefault()}>
              <Icon name="plus" size={16} />
            </button>
            <button className="handle-btn grip" aria-label="Drag to move, click for options" onClick={(e) => blockMenu(e.currentTarget)}>
              <Icon name="grip" size={16} />
            </button>
          </div>
        </DragHandle>
        <EditorContent editor={editor} />
        <BubbleToolbar editor={editor} />
      </article>
      <Toolbar editor={editor} uploading={uploading > 0} onImage={() => void chooseImage()} />
    </>
  )
})

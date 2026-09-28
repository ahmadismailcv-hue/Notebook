import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extensions'
import { pickImage, uploadImage } from '../lib/images'
import type { Snapshot } from '../lib/pageSaver'
import { Toolbar } from './Toolbar'

interface Props {
  initial: Snapshot
  onChange: (snap: Snapshot) => void
}

export function PageEditor({ initial, onChange }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [uploading, setUploading] = useState(0)
  const titleRef = useRef(title)
  const titleEl = useRef<HTMLTextAreaElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const insertFiles = async (files: File[], pos?: number) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length || !editor) return false
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
    return true
  }
  const insertFilesRef = useRef(insertFiles)
  insertFilesRef.current = insertFiles

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      Image.configure({ allowBase64: false }),
      Highlight,
      Placeholder.configure({ placeholder: 'Start writing…' }),
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
    onUpdate: ({ editor: e }) => onChangeRef.current({ title: titleRef.current, content: e.getJSON() as JSONContent }),
  })

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

  return (
    <>
      <Toolbar
        editor={editor}
        uploading={uploading > 0}
        onImage={async () => {
          const file = await pickImage()
          if (file) void insertFiles([file])
        }}
      />
      <article className="page">
        <textarea
          ref={titleEl}
          className="page-title"
          rows={1}
          placeholder="Untitled"
          value={title}
          onChange={(e) => {
            const v = e.target.value.replace(/\n/g, ' ')
            setTitle(v)
            titleRef.current = v
            onChangeRef.current({ title: v, content: editor.getJSON() as JSONContent })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              editor.commands.focus('start')
            }
          }}
        />
        <EditorContent editor={editor} />
      </article>
    </>
  )
}

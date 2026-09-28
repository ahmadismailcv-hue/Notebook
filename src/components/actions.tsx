import { useLocation, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../lib/workspace'
import { NOTEBOOK_COLORS } from '../lib/types'
import { useDialog } from './Dialog'
import { EmojiPicker } from './EmojiPicker'
import { Icon } from './icons'
import { Menu, usePopover } from './Popover'

const COLOR_NAMES = ['Sand', 'Peach', 'Sage', 'Sky', 'Lilac', 'Butter', 'Charcoal']

export const displayTitle = (t: string | null | undefined) => (t && t.trim()) || 'Untitled'

async function attempt(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (e) {
    alert(`Something went wrong: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// One place for the "⋯" menus, so the sidebar and the gallery cards behave identically.
export function useItemActions() {
  const ws = useWorkspace()
  const dialog = useDialog()
  const popover = usePopover()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const pickIcon = (anchor: HTMLElement, onPick: (icon: string | null) => void) =>
    popover.open(anchor, (close) => <EmojiPicker close={close} onPick={onPick} onRemove={() => onPick(null)} />)

  const notebookMenu = (anchor: HTMLElement, id: string) => {
    const nb = ws.findNotebook(id)
    if (!nb) return
    popover.open(anchor, (close) => (
      <Menu
        close={close}
        title={displayTitle(nb.title)}
        items={[
          { label: 'Rename', icon: <Icon name="edit" />, onSelect: () => void rename('notebook', id, nb.title) },
          { label: 'Change icon', icon: <Icon name="smile" />, onSelect: () => pickIcon(anchor, (icon) => void attempt(() => ws.updateNotebook(id, { icon }))) },
          {
            label: 'Card colour',
            icon: <Icon name="palette" />,
            onSelect: () =>
              popover.open(anchor, (c) => (
                <Menu
                  close={c}
                  title="Card colour"
                  items={NOTEBOOK_COLORS.map((color, i) => ({
                    label: COLOR_NAMES[i],
                    icon: <span className="swatch" style={{ background: color }} />,
                    onSelect: () => void attempt(() => ws.updateNotebook(id, { color })),
                  }))}
                />
              )),
          },
          { label: 'New module inside', icon: <Icon name="plus" />, onSelect: () => void attempt(async () => navigate(`/m/${await ws.createModule(id)}`)) },
          'divider',
          {
            label: 'Delete',
            icon: <Icon name="trash" />,
            danger: true,
            onSelect: () =>
              void attempt(async () => {
                const ok = await dialog.confirm('Delete notebook?', `“${displayTitle(nb.title)}” and every module and page inside it will be permanently deleted.`, {
                  okLabel: 'Delete',
                  danger: true,
                })
                if (!ok) return
                const inside = pathname === `/n/${id}` || nb.modules.some((m) => pathname === `/m/${m.id}` || m.pages.some((p) => pathname === `/p/${p.id}`))
                await ws.deleteNotebook(id)
                if (inside) navigate('/', { replace: true })
              }),
          },
        ]}
      />
    ))
  }

  const moduleMenu = (anchor: HTMLElement, id: string) => {
    const m = ws.findModule(id)
    if (!m) return
    popover.open(anchor, (close) => (
      <Menu
        close={close}
        title={displayTitle(m.title)}
        items={[
          { label: 'Rename', icon: <Icon name="edit" />, onSelect: () => void rename('module', id, m.title) },
          { label: 'Change icon', icon: <Icon name="smile" />, onSelect: () => pickIcon(anchor, (icon) => void attempt(() => ws.updateModule(id, { icon }))) },
          { label: 'New page inside', icon: <Icon name="plus" />, onSelect: () => void attempt(async () => navigate(`/p/${await ws.createPage(id)}`)) },
          'divider',
          {
            label: 'Delete',
            icon: <Icon name="trash" />,
            danger: true,
            onSelect: () =>
              void attempt(async () => {
                const ok = await dialog.confirm('Delete module?', `“${displayTitle(m.title)}” and every page inside it will be permanently deleted.`, {
                  okLabel: 'Delete',
                  danger: true,
                })
                if (!ok) return
                const inside = pathname === `/m/${id}` || m.pages.some((p) => pathname === `/p/${p.id}`)
                await ws.deleteModule(id)
                if (inside) navigate(`/n/${m.notebook_id}`, { replace: true })
              }),
          },
        ]}
      />
    ))
  }

  const pageMenu = (anchor: HTMLElement, id: string) => {
    const p = ws.findPage(id)
    if (!p) return
    popover.open(anchor, (close) => (
      <Menu
        close={close}
        title={displayTitle(p.title)}
        items={[
          {
            label: 'Delete',
            icon: <Icon name="trash" />,
            danger: true,
            onSelect: () =>
              void attempt(async () => {
                const ok = await dialog.confirm('Delete page?', `“${displayTitle(p.title)}” will be permanently deleted.`, { okLabel: 'Delete', danger: true })
                if (!ok) return
                await ws.deletePage(id)
                if (pathname === `/p/${id}`) navigate(`/m/${p.module_id}`, { replace: true })
              }),
          },
        ]}
      />
    ))
  }

  const rename = async (kind: 'notebook' | 'module', id: string, current: string) => {
    const title = await dialog.prompt(`Rename ${kind}`, current)
    if (title == null) return
    await attempt(() => (kind === 'notebook' ? ws.updateNotebook(id, { title }) : ws.updateModule(id, { title })))
  }

  return { notebookMenu, moduleMenu, pageMenu, pickIcon, attempt }
}

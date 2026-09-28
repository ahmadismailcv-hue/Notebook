import type { JSONContent } from '@tiptap/react'
import type { CSSProperties } from 'react'

export interface Notebook {
  id: string
  title: string
  icon: string | null
  color: string
  cover_url: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface Module {
  id: string
  notebook_id: string
  title: string
  icon: string | null
  cover_url: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface Page {
  id: string
  module_id: string
  title: string
  icon: string | null
  banner_url: string | null
  content: JSONContent
  preview_text: string
  cover_url: string | null
  position: number
  created_at: string
  updated_at: string
}

export type PageSummary = Omit<Page, 'content'>

export const NOTEBOOK_COLORS = ['#e8e2d6', '#f3d9c9', '#d9e4d2', '#d4e0ec', '#e6d8ec', '#f2e7b8', '#2b2926']

// Cover banners: an uploaded image URL, or one of these presets stored as "preset:<n>".
export const BANNER_PRESETS = [
  'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(120deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(120deg, #434343 0%, #1f1d1a 100%)',
]

export function bannerStyle(banner: string): CSSProperties {
  if (banner.startsWith('preset:')) return { background: BANNER_PRESETS[Number(banner.slice(7))] ?? BANNER_PRESETS[0] }
  return { backgroundImage: `url("${banner}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

export const DEFAULT_ICON = { notebook: '📓', module: '📁', page: '📄' } as const

import type { JSONContent } from '@tiptap/react'

export interface Notebook {
  id: string
  title: string
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
  cover_url: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface Page {
  id: string
  module_id: string
  title: string
  content: JSONContent
  preview_text: string
  cover_url: string | null
  position: number
  created_at: string
  updated_at: string
}

export type PageSummary = Omit<Page, 'content'>

export const NOTEBOOK_COLORS = ['#e8e2d6', '#f3d9c9', '#d9e4d2', '#d4e0ec', '#e6d8ec', '#f2e7b8', '#2b2926']

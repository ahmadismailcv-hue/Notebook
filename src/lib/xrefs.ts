import { supabase } from './supabase'

// A cross-reference is made in two steps: mark the first passage, then (on any page) the second.
// Between the two taps, the first end waits here.
export interface PendingXref {
  ref: string
  pageId: string
  quote: string
}

const KEY = 'nb:xref-pending'
const listeners = new Set<() => void>()

export function getPendingXref(): PendingXref | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingXref) : null
  } catch {
    return null
  }
}

export function setPendingXref(p: PendingXref | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function onPendingXref(l: () => void) {
  listeners.add(l)
  return () => void listeners.delete(l)
}

export interface XrefEnd {
  pageId: string
  ref: string
  quote: string
}

export async function linkXref(a: XrefEnd, b: XrefEnd) {
  const { error } = await supabase
    .from('xrefs')
    .insert({ a_page: a.pageId, a_ref: a.ref, a_quote: a.quote.slice(0, 300), b_page: b.pageId, b_ref: b.ref, b_quote: b.quote.slice(0, 300) })
  if (error) throw new Error(error.message)
}

interface XrefRow {
  a_page: string
  a_ref: string
  a_quote: string
  b_page: string
  b_ref: string
  b_quote: string
}

/** The other end(s) of a cross-reference. */
export async function findXrefTargets(ref: string): Promise<XrefEnd[]> {
  const { data, error } = await supabase.from('xrefs').select('a_page, a_ref, a_quote, b_page, b_ref, b_quote').or(`a_ref.eq.${ref},b_ref.eq.${ref}`)
  if (error) throw new Error(error.message)
  return ((data as XrefRow[]) ?? []).map((r) =>
    r.a_ref === ref ? { pageId: r.b_page, ref: r.b_ref, quote: r.b_quote } : { pageId: r.a_page, ref: r.a_ref, quote: r.a_quote },
  )
}

export async function deleteXref(ref: string) {
  const { error } = await supabase.from('xrefs').delete().or(`a_ref.eq.${ref},b_ref.eq.${ref}`)
  if (error) throw new Error(error.message)
}

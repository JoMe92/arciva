import { useState } from 'react'

/**
 * Storage key used to persist the archive list in localStorage. Keeping
 * this exported allows other modules (e.g. unit tests) to reference
 * the same key.
 */
export const ARCHIVE_KEY = 'stoneTrail:archive'

/**
 * Hook managing archived project ids. It loads the archive list from
 * localStorage on first render and persists changes automatically.
 *
 * @returns An object with the current archive list and helpers to
 *          determine if a project is archived or to archive/unarchive
 */
export function useArchive() {
  const [archived, setArchived] = useState<string[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(ARCHIVE_KEY) : null
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const isArchived = (id: string) => archived.includes(id)

  const archive = (id: string) =>
    setArchived((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      try {
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next))
      } catch {
        /* ignore storage errors */
      }
      return next
    })

  const unarchive = (id: string) =>
    setArchived((prev) => {
      const next = prev.filter((x) => x !== id)
      try {
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next))
      } catch {
        /* ignore storage errors */
      }
      return next
    })

  return { archived, isArchived, archive, unarchive }
}

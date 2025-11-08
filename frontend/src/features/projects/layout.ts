import type { Project } from './types'

export type Aspect = Project['aspect']
export type LayoutKind = 'project' | 'create'

export type LayoutItem =
  | { kind: 'create'; aspect?: Aspect; span: 1; scale?: number }
  | { kind: 'project'; project: Project; span: 1 | 2 }

export type LayoutRow = { items: LayoutItem[]; cols: 3 | 4; gapX: 'gap-x-10' | 'gap-x-16'; offsetTop?: string }

/**
 * Baut ein „artistisches“ Raster:
 * - erste Reihe abhängig vom ersten echten Projekt
 * - danach: landscapes = span 2, portrait/square = span 1
 * - leichte Offsets für Rhythmus
 */
export function buildLayout(projects: Project[], withCreate = true): LayoutRow[] {
  const rows: LayoutRow[] = []
  const rest = [...projects]

  // Erste Reihe
  if (withCreate) {
    const first = rest[0]
    if (first) {
      if (first.aspect === 'landscape') {
        // Create klein + Landscape groß
        rows.push({
          cols: 3,
          gapX: 'gap-x-10',
          items: [
            { kind: 'create', aspect: 'landscape', span: 1 },
            { kind: 'project', project: first, span: 2 },
          ],
          offsetTop: 'mt-0',
        })
        rest.shift()
      } else {
        // Drei Portrait/Square nebeneinander (falls vorhanden)
        const a = rest.shift()!
        const b = rest[0] && rest[0].aspect !== 'landscape' ? rest.shift()! : undefined
        rows.push({
          cols: 3,
          gapX: 'gap-x-10',
          items: [
            { kind: 'create', aspect: first?.aspect || 'portrait', span: 1 },
            { kind: 'project', project: a, span: 1 },
            ...(b ? [{ kind: 'project', project: b, span: 1 } as LayoutItem] : []),
          ],
          offsetTop: 'mt-0',
        })
      }
    } else {
      // Keine Projekte → nur Create in Standardgröße
      rows.push({
        cols: 3,
        gapX: 'gap-x-10',
        items: [{ kind: 'create', aspect: 'portrait', span: 1 }],
        offsetTop: 'mt-0',
      })
    }
  }

  // Folgereihen
  let rowIndex = 1
  while (rest.length) {
    const cols: 3 | 4 = rowIndex % 2 === 0 ? 4 : 3
    const gapX: LayoutRow['gapX'] = rowIndex % 2 === 0 ? 'gap-x-16' : 'gap-x-10'
    const items: LayoutItem[] = []
    let usedCols = 0

    while (usedCols < cols && rest.length) {
      const p = rest[0]
      const span: 1 | 2 = p.aspect === 'landscape' && usedCols <= cols - 2 ? 2 : 1
      // Regel: max 1 landscape pro Reihe
      const hasLandscape = items.some(i => i.kind === 'project' && i.span === 2)
      if (span === 2 && hasLandscape) {
        // wenn schon Landscape drin, nimm ein Portrait/Square
        const idx = rest.findIndex(x => x.aspect !== 'landscape')
        if (idx > 0) {
          const swapped = rest.splice(idx, 1)[0]
          const sSpan: 1 = 1
          if (usedCols + sSpan <= cols) {
            items.push({ kind: 'project', project: swapped, span: sSpan })
            usedCols += sSpan
            continue
          }
        }
      }
      if (usedCols + span <= cols) {
        items.push({ kind: 'project', project: rest.shift()!, span })
        usedCols += span
      } else break
    }

    rows.push({
      cols,
      gapX,
      items,
      offsetTop: rowIndex % 2 ? 'mt-6' : 'mt-2', // kleine Versätze
    })
    rowIndex++
  }

  return rows
}

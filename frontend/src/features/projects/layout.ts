import type { Project, ProjectPreviewImage } from './types'
import { aspectRatioValue, fallbackAspectRatioForAspect } from './utils'

export type Aspect = Project['aspect']
export type LayoutKind = 'project' | 'create'

export type LayoutItem =
  | { kind: 'create'; aspect?: Aspect; span: 1; scale?: number; matchAspectRatio?: string }
  | { kind: 'project'; project: Project; span: 1 | 2 }

export type LayoutRow = { items: LayoutItem[]; cols: 3 | 4; gapX: 'gap-x-10' | 'gap-x-16'; offsetTop?: string }

function primaryPreview(project: Project): ProjectPreviewImage | null {
  if (!project.previewImages || !project.previewImages.length) return null
  return project.previewImages.reduce<ProjectPreviewImage | null>((best, current) => {
    if (!current) return best
    if (!best) return current
    return current.order < best.order ? current : best
  }, null)
}

function primaryAspectRatioString(project: Project): string {
  const preview = primaryPreview(project)
  return aspectRatioValue(preview?.width, preview?.height) ?? fallbackAspectRatioForAspect(project.aspect)
}

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
    const primary = rest.shift()
    if (primary) {
      const secondary = rest.shift()
      const primaryRatio = primaryAspectRatioString(primary)
      rows.push({
        cols: 3,
        gapX: 'gap-x-10',
        items: [
          { kind: 'create', aspect: primary.aspect, span: 1, matchAspectRatio: primaryRatio },
          { kind: 'project', project: primary, span: 1 },
          ...(secondary ? [{ kind: 'project', project: secondary, span: 1 } as LayoutItem] : []),
        ],
        offsetTop: 'mt-0',
      })
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

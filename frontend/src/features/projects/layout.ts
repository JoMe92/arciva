import type { Project, ProjectPreviewImage } from './types'
import { aspectRatioValue, fallbackAspectRatioForAspect } from './utils'

export type Aspect = Project['aspect']
export type LayoutKind = 'project' | 'create'

export type ArtistSize = 's' | 'm' | 'l'

export type ArtistFootprint = {
  size: ArtistSize
  margin: number
}

export type FirstRowArtistPlan = {
  templateColumns: [number, number, number]
  footprints: Record<'create' | string, ArtistFootprint>
  createAspect?: Aspect
  createMatchRatio?: string
  gap: number
}

export type LayoutItem =
  | {
      kind: 'create'
      aspect?: Aspect
      span: 1
      matchAspectRatio?: string
      artist?: ArtistFootprint
    }
  | { kind: 'project'; project: Project; span: 1 | 2; artist?: ArtistFootprint }

export type LayoutRow = {
  items: LayoutItem[]
  cols: 3 | 4
  gapX: 'gap-x-10' | 'gap-x-16'
  offsetTop?: string
  artistTemplate?: string
  artistGap?: number
}

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
  return (
    aspectRatioValue(preview?.width, preview?.height) ??
    fallbackAspectRatioForAspect(project.aspect)
  )
}

/**
 * Builds an artistic grid:
 * - first row depends on the first actual project
 * - afterwards: landscapes span 2, portrait/square span 1
 * - subtle offsets add rhythm
 */
export function buildLayout(
  projects: Project[],
  withCreate = true,
  firstRowPlan?: FirstRowArtistPlan
): LayoutRow[] {
  const rows: LayoutRow[] = []
  const rest = [...projects]

  // First row
  if (withCreate) {
    const primary = rest.shift()
    if (primary) {
      const secondary = rest.shift()
      const primaryRatio = primaryAspectRatioString(primary)
      const artistTemplate = firstRowPlan
        ? firstRowPlan.templateColumns.map((v) => `${v}fr`).join(' ')
        : undefined
      rows.push({
        cols: 3,
        gapX: 'gap-x-10',
        items: [
          {
            kind: 'create',
            aspect: firstRowPlan?.createAspect ?? primary.aspect,
            span: 1,
            matchAspectRatio: firstRowPlan?.createMatchRatio ?? primaryRatio,
            artist: firstRowPlan?.footprints.create,
          },
          {
            kind: 'project',
            project: primary,
            span: 1,
            artist: firstRowPlan?.footprints[primary.id],
          },
          ...(secondary
            ? [
                {
                  kind: 'project',
                  project: secondary,
                  span: 1,
                  artist: firstRowPlan?.footprints[secondary.id],
                } as LayoutItem,
              ]
            : []),
        ],
        offsetTop: 'mt-0',
        artistTemplate,
        artistGap: firstRowPlan?.gap,
      })
    } else {
      // No projects left → show only a default create slot
      rows.push({
        cols: 3,
        gapX: 'gap-x-10',
        items: [{ kind: 'create', aspect: 'portrait', span: 1 }],
        offsetTop: 'mt-0',
      })
    }
  }

  // Subsequent rows
  let rowIndex = 1
  while (rest.length) {
    const cols: 3 | 4 = rowIndex % 2 === 0 ? 4 : 3
    const gapX: LayoutRow['gapX'] = rowIndex % 2 === 0 ? 'gap-x-16' : 'gap-x-10'
    const items: LayoutItem[] = []
    let usedCols = 0

    while (usedCols < cols && rest.length) {
      const p = rest[0]
      const span: 1 | 2 = p.aspect === 'landscape' && usedCols <= cols - 2 ? 2 : 1
      // Rule: max 1 landscape per row
      const hasLandscape = items.some((i) => i.kind === 'project' && i.span === 2)
      if (span === 2 && hasLandscape) {
        // if a landscape already exists, prefer a portrait/square
        const idx = rest.findIndex((x) => x.aspect !== 'landscape')
        if (idx > 0) {
          const swapped = rest.splice(idx, 1)[0]
          const sSpan = 1 as const
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
      offsetTop: rowIndex % 2 ? 'mt-6' : 'mt-2', // slight offsets
    })
    rowIndex++
  }

  return rows
}

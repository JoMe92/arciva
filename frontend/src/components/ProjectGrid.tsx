import React from 'react'
import type { Project } from '../features/projects/types'
import Row from './Row'
import {
  buildLayout,
  type FirstRowArtistPlan,
  type Aspect,
  type ArtistSize,
} from '../features/projects/layout'

const ProjectGrid: React.FC<{
  items: Project[]
  onOpen: (id: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onCreate: () => void
  archiveMode: boolean
  onEdit: (p: Project) => void
  onSelectPrimary?: (projectId: string, assetId: string) => Promise<void>
}> = ({
  items,
  onOpen,
  onArchive,
  onUnarchive,
  onCreate,
  archiveMode,
  onEdit,
  onSelectPrimary,
}) => {
  // In der Archive-Ansicht keine Create-Card
  const firstRowPlan = useFirstRowArtistPlan(items, !archiveMode)
  const layout = buildLayout(items, !archiveMode, firstRowPlan)

  return (
    <div className="space-y-14">
      {layout.map((row, i) => (
        <Row
          key={i}
          row={row}
          index={i}
          onOpen={onOpen}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onCreate={onCreate}
          archiveMode={archiveMode}
          onEdit={onEdit}
          onSelectPrimary={onSelectPrimary}
        />
      ))}
    </div>
  )
}

export default ProjectGrid

type Orientation = 'landscape' | 'portrait'

const normalizeOrientation = (aspect?: Aspect): Orientation =>
  aspect === 'landscape' ? 'landscape' : 'portrait'

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min
const randomIntBetween = (min: number, max: number) => Math.round(randomBetween(min, max))

const shuffle = <T,>(input: T[]): T[] => {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const SIZE_SCALE: Record<ArtistSize, number | (() => number)> = {
  s: 0.9,
  m: 1,
  l: () => randomBetween(1.15, 1.25),
}

const getScale = (size: ArtistSize) => {
  const value = SIZE_SCALE[size]
  return typeof value === 'function' ? value() : value
}

type CachedPlan = { key: string; plan?: FirstRowArtistPlan }

function useFirstRowArtistPlan(
  projects: Project[],
  withCreate: boolean
): FirstRowArtistPlan | undefined {
  const cacheRef = React.useRef<CachedPlan | null>(null)
  if (!withCreate || projects.length < 2) {
    return undefined
  }

  const first = projects[0]
  const second = projects[1]
  if (!first || !second) return undefined
  const key = `${first.id}:${second.id}:${first.aspect}:${second.aspect}`

  if (!cacheRef.current || cacheRef.current.key !== key) {
    cacheRef.current = {
      key,
      plan: buildFirstRowArtistPlan(first, second),
    }
  }

  return cacheRef.current.plan
}

function buildFirstRowArtistPlan(primary: Project, secondary: Project): FirstRowArtistPlan {
  const primaryOrientation = normalizeOrientation(primary.aspect)
  const secondaryOrientation = normalizeOrientation(secondary.aspect)
  const orientations: Orientation[] = [primaryOrientation, secondaryOrientation]
  let createOrientation: Orientation
  if (primaryOrientation === secondaryOrientation) {
    createOrientation = primaryOrientation
  } else {
    createOrientation = Math.random() > 0.5 ? 'landscape' : 'portrait'
  }
  orientations.unshift(createOrientation)

  const allSame = orientations.every((o) => o === orientations[0])
  const gap = randomIntBetween(12, 26)
  if (allSame) {
    return {
      templateColumns: [1, 1, 1],
      footprints: {
        create: { size: 'm', margin: 12 },
        [primary.id]: { size: 'm', margin: 12 },
        [secondary.id]: { size: 'm', margin: 12 },
      },
      createAspect: createOrientation,
      gap,
    }
  }

  const sizePattern = pickSizePattern()
  const templateColumns: [number, number, number] = [
    getScale(sizePattern[0]),
    getScale(sizePattern[1]),
    getScale(sizePattern[2]),
  ]
  const margins = sizePattern.map(() => randomIntBetween(8, 18))

  return {
    templateColumns,
    footprints: {
      create: { size: sizePattern[0], margin: margins[0] },
      [primary.id]: { size: sizePattern[1], margin: margins[1] },
      [secondary.id]: { size: sizePattern[2], margin: margins[2] },
    },
    createAspect: createOrientation,
    createMatchRatio: createOrientation === 'landscape' ? '16 / 9' : '3 / 4',
    gap,
  }
}

function pickSizePattern(): ArtistSize[] {
  const useBalancedSet = Math.random() > 0.5
  if (useBalancedSet) {
    return shuffle<ArtistSize>(['l', 'm', 's'])
  }
  const specialSize: ArtistSize = Math.random() > 0.5 ? 'l' : 's'
  const pattern: ArtistSize[] = ['m', 'm', specialSize]
  return shuffle(pattern)
}

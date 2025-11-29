import React from 'react'
import type { Aspect } from '../features/projects/layout'
import { aspectClass, placeholderRatioForAspect } from '../features/projects/utils'
import { RawPlaceholder } from './RawPlaceholder'

const spanClass = (span: 1 | 2) => (span === 2 ? 'col-span-2' : 'col-span-1')

type SkeletonItem = {
  id: string
  span: 1 | 2
  aspect: Aspect
}

type SkeletonRow = {
  id: string
  cols: 3 | 4
  gapX: 'gap-x-10' | 'gap-x-16'
  offsetTop?: string
  items: SkeletonItem[]
}

const skeletonRows: SkeletonRow[] = [
  {
    id: 'row-1',
    cols: 3,
    gapX: 'gap-x-10',
    offsetTop: 'mt-0',
    items: [
      { id: 'row-1-item-1', span: 1, aspect: 'landscape' },
      { id: 'row-1-item-2', span: 1, aspect: 'portrait' },
      { id: 'row-1-item-3', span: 1, aspect: 'square' },
    ],
  },
  {
    id: 'row-2',
    cols: 3,
    gapX: 'gap-x-10',
    offsetTop: 'mt-6',
    items: [
      { id: 'row-2-item-1', span: 1, aspect: 'portrait' },
      { id: 'row-2-item-2', span: 1, aspect: 'portrait' },
      { id: 'row-2-item-3', span: 1, aspect: 'landscape' },
    ],
  },
  {
    id: 'row-3',
    cols: 4,
    gapX: 'gap-x-16',
    offsetTop: 'mt-2',
    items: [
      { id: 'row-3-item-1', span: 2, aspect: 'landscape' },
      { id: 'row-3-item-2', span: 1, aspect: 'portrait' },
      { id: 'row-3-item-3', span: 1, aspect: 'square' },
    ],
  },
  {
    id: 'row-4',
    cols: 3,
    gapX: 'gap-x-10',
    offsetTop: 'mt-6',
    items: [
      { id: 'row-4-item-1', span: 1, aspect: 'portrait' },
      { id: 'row-4-item-2', span: 1, aspect: 'landscape' },
      { id: 'row-4-item-3', span: 1, aspect: 'portrait' },
    ],
  },
]

const ProjectGridSkeleton: React.FC = () => (
  <div className="space-y-14">
    {skeletonRows.map((row) => (
      <div key={row.id} className={row.offsetTop ?? ''}>
        <div
          className={`grid ${row.cols === 4 ? 'grid-cols-4' : 'grid-cols-3'} ${row.gapX} gap-y-10 items-start`}
        >
          {row.items.map((item) => (
            <div
              key={item.id}
              className={`${spanClass(item.span)} rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] shadow-sm`}
            >
              <div
                className={`relative ${aspectClass(item.aspect)} w-full overflow-hidden bg-[var(--placeholder-bg-beige,#F3EBDD)]`}
              >
                <RawPlaceholder
                  ratio={placeholderRatioForAspect(item.aspect)}
                  title="Loading project preview"
                  className="absolute inset-0 animate-pulse"
                />
              </div>
              <div className="space-y-2 border-t border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2.5">
                <div className="h-3 w-2/3 rounded-full bg-[var(--placeholder-motif-bar,#4A463F)]/20 animate-pulse" />
                <div className="h-2 w-1/2 rounded-full bg-[var(--placeholder-motif-bar,#4A463F)]/15 animate-pulse" />
                <div className="flex gap-2 pt-2">
                  <span className="h-8 flex-1 rounded-full bg-[var(--placeholder-motif-bar,#4A463F)]/15 animate-pulse" />
                  <span className="h-8 w-14 rounded-full bg-[var(--placeholder-motif-bar,#4A463F)]/15 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
)

export default ProjectGridSkeleton

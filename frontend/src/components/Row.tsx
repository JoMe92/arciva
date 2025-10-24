import React from 'react'
import type { Project } from '../features/projects/types'
import ProjectCard from './ProjectCard'
import CreateCard from './CreateCard'
import type { LayoutRow, LayoutItem } from '../features/projects/layout'

const spanClass = (n: 1 | 2) => (n === 2 ? 'col-span-2' : 'col-span-1')

const Row: React.FC<{
  row: LayoutRow
  index: number
  onOpen: (id: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onCreate: () => void
  archiveMode: boolean
  onEdit: (p: Project) => void
}> = ({ row, index, onOpen, onArchive, onUnarchive, onCreate, archiveMode, onEdit }) => {
  const colsClass = row.cols === 4 ? 'grid-cols-4' : 'grid-cols-3'
  return (
    <div className={`${row.offsetTop || ''}`}>
      <div className={`grid ${colsClass} ${row.gapX} gap-y-10 items-start`}>
        {row.items.map((it, i) => {
          if (it.kind === 'create') {
            // CreateCard: kleiner & 1 Spalte
            return (
              <div key={`c-${i}`} className={`${spanClass(1)} ${it.scale ? `scale-[${it.scale}] origin-top-left` : ''}`}>
                {archiveMode ? null : <CreateCard onClick={onCreate} aspect={it.aspect || 'portrait'} />}
              </div>
            )
          }
          return (
            <div key={it.project.id} className={spanClass(it.span)}>
              <ProjectCard
                p={it.project}
                onOpen={onOpen}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                archiveMode={archiveMode}
                onEdit={onEdit}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Row

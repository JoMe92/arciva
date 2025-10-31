import React from 'react'
import type { Project } from '../features/projects/types'
import Row from './Row'
import { buildLayout } from '../features/projects/layout'

const ProjectGrid: React.FC<{
  items: Project[]
  onOpen: (id: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onCreate: () => void
  archiveMode: boolean
  onEdit: (p: Project) => void
  onSelectPrimary?: (projectId: string, assetId: string) => Promise<void>
}> = ({ items, onOpen, onArchive, onUnarchive, onCreate, archiveMode, onEdit, onSelectPrimary }) => {
  // In der Archive-Ansicht keine Create-Card
  const layout = buildLayout(items, !archiveMode)

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

import React from 'react';
import type { Project } from '../features/projects/types';
import { composeRows } from '../features/projects/utils';
import Row from './Row';

export interface ProjectGridProps {
  items: Project[];
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onCreate: () => void;
  archiveMode: boolean;
  onEdit: (p: Project) => void;
}

/**
 * Composes the flat list of projects into a set of rows according to
 * the pattern defined in utilities. Prepends a create tile when
 * archive mode is off. Delegates rendering of each row to the Row
 * component.
 */
const ProjectGrid: React.FC<ProjectGridProps> = ({ items, onOpen, onArchive, onUnarchive, onCreate, archiveMode, onEdit }) => {
  const base: (Project | '__create__')[] = archiveMode ? items : ['__create__', ...items];
  const rows = composeRows(base);
  return (
    <div className="space-y-14">
      {rows.map((r, i) => (
        <Row
          key={i}
          items={r}
          index={i}
          onOpen={onOpen}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onCreate={onCreate}
          archiveMode={archiveMode}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};

export default ProjectGrid;
import React from 'react';
import type { Project } from '../features/projects/types';
import ProjectCard from './ProjectCard';
import CreateCard from './CreateCard';

export interface RowProps {
  items: (Project | '__create__')[];
  index: number;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onCreate: () => void;
  archiveMode: boolean;
  onEdit: (p: Project) => void;
}

/**
 * A responsive row within the project grid. The number of columns is
 * determined by the number of items in the row. The row alternates
 * horizontal spacing for a more dynamic layout.
 */
const Row: React.FC<RowProps> = ({ items, index, onOpen, onArchive, onUnarchive, onCreate, archiveMode, onEdit }) => {
  const colClass = items.length === 1 ? 'grid-cols-1' : items.length === 2 ? 'grid-cols-2' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-4';
  const gapClass = index % 2 ? 'gap-x-16' : 'gap-x-10';
  return (
    <div className={`grid ${colClass} ${gapClass} gap-y-10 items-start`}>
      {items.map((it, i) => {
        if (it === '__create__') {
          return archiveMode ? null : <CreateCard key={`c-${i}`} onClick={onCreate} />;
        }
        const p = it as Project;
        return (
          <ProjectCard
            key={p.id}
            p={p}
            onOpen={onOpen}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            archiveMode={archiveMode}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
};

export default Row;
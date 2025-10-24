import React, { useState } from 'react';
import ModalShell from './ModalShell';
import ProjectFields from './ProjectFields';

export interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, desc: string, client: string, tags: string[]) => void;
  existingTags: string[];
}

/**
 * Modal for creating a new project. It collects title, description,
 * client and tag information and passes the values to the onCreate
 * handler. The modal remains mounted only when open is true.
 */
const CreateModal: React.FC<CreateModalProps> = ({ open, onClose, onCreate, existingTags }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [client, setClient] = useState('');
  const [selTags, setSelTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  if (!open) return null;

  const submit = () => {
    onCreate(title || 'Untitled project', desc || 'New project', client || 'Unassigned', selTags);
    onClose();
  };

  return (
    <ModalShell title="Create new project" onClose={onClose} onPrimary={submit} primaryLabel="Create">
      <ProjectFields
        title={title}
        setTitle={setTitle}
        desc={desc}
        setDesc={setDesc}
        client={client}
        setClient={setClient}
        selTags={selTags}
        setSelTags={setSelTags}
        newTag={newTag}
        setNewTag={setNewTag}
        existingTags={existingTags}
      />
    </ModalShell>
  );
};

export default CreateModal;
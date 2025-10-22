/**
 * Defines the core data structure for a project. Each project has
 * identifiers and optional metadata such as tags and a representative
 * image. The aspect property controls the default aspect ratio of
 * thumbnails and placeholders.
 */
export type Project = {
  id: string;
  title: string;
  client: string;
  blurb?: string;
  aspect: 'portrait' | 'landscape' | 'square';
  image?: string | null;
  tags?: string[];
};
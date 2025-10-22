import type { Project } from './types';

/**
 * A collection of Unsplash and Wikimedia image URLs used for the demo
 * dataset. Keeping these in a single object makes it easy to swap
 * sources or adjust resolutions globally.
 */
export const U = {
  bike: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  knit: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1400&q=80',
  portrait: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
  felt: 'https://images.unsplash.com/photo-1551292831-023188e78222?auto=format&fit=crop&w=1400&q=80',
  glacier: 'https://images.unsplash.com/photo-1500043357865-c6b8827edf3a?auto=format&fit=crop&w=1600&q=80',
  trail: 'https://images.unsplash.com/photo-1501706362039-c06b2d715385?auto=format&fit=crop&w=1600&q=80',
  stone: 'https://upload.wikimedia.org/wikipedia/commons/2/25/Stone_path_in_forest.jpg',
  city: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1600&q=80',
  studio: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1400&q=80'
} as const;

/**
 * A hand-crafted list of nine demo projects used to illustrate the
 * application. The ids are stable and referenced from several
 * components. Note that image fields can be null to trigger
 * placeholder rendering.
 */
export const PROJECTS: Project[] = [
  { id: 'p1', title: 'Red XPLR', client: 'SRAM', aspect: 'portrait', image: U.bike, tags: ['gravel', 'outdoor'] },
  { id: 'p2', title: 'Polo Country', client: 'Element × Ralph Lauren', aspect: 'portrait', image: U.knit, tags: ['fashion', 'editorial'] },
  { id: 'p3', title: 'Lena Mantler', client: 'SZ Magazin', aspect: 'portrait', image: U.portrait, tags: ['portrait'] },
  { id: 'p4', title: 'Mayer of Munich', client: 'Monocle', aspect: 'portrait', image: U.felt, tags: ['reportage', 'color'] },
  { id: 'p5', title: 'Glacier Line', client: 'Editorial', aspect: 'landscape', image: null, tags: ['landscape', 'travel'] },
  { id: 'p6', title: 'Trail Push', client: 'Patagonia', aspect: 'landscape', image: U.trail, tags: ['brand', 'outdoor'] },
  { id: 'p7', title: 'Stone Trail', client: 'CI', aspect: 'square', image: U.stone, tags: ['identity'] },
  { id: 'p8', title: 'Atelier', client: 'Studio', aspect: 'portrait', image: U.studio, tags: ['studio'] },
  { id: 'p9', title: 'Urban Grid', client: 'City Works', aspect: 'landscape', image: U.city, tags: ['architecture'] }
];
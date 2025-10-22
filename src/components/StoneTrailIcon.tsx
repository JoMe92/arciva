import React from 'react';
import { S } from '../features/projects/utils';

/**
 * Colour tokens used exclusively by the StoneTrailIcon. These mirror
 * the custom CSS variables but provide fallback values. Should you
 * theme the application with different variables, adjust these
 * defaults accordingly.
 */
const TOKENS = {
  clay: 'var(--clay-500, #A56A4A)',
  sand: 'var(--sand-500, #D7C5A6)',
  basalt: 'var(--basalt-700, #4A463F)',
};

export interface StoneTrailIconProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Renders a simple three-stone icon reminiscent of a trail. The
 * component supports custom sizing and optional class names for
 * styling or animation. An aria-label is provided for screen
 * readers.
 */
export const StoneTrailIcon: React.FC<StoneTrailIconProps> = ({
  size = 18,
  className = '',
  title = 'Stone Trail',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={`block ${className}`}
    >
      <ellipse cx={S(7)} cy={S(16)} rx={S(2.6)} ry={S(2)} fill={TOKENS.clay} />
      <ellipse cx={S(12)} cy={S(12)} rx={S(2.2)} ry={S(1.7)} fill={TOKENS.sand} />
      <ellipse cx={S(16.5)} cy={S(8.5)} rx={S(1.9)} ry={S(1.5)} fill={TOKENS.basalt} />
    </svg>
  );
};

export default StoneTrailIcon;
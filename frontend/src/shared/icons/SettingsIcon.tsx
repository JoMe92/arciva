import React from 'react'

/**
 * Gear icon used for project settings entry points. Centralising it keeps
 * the visual treatment identical anywhere the settings affordance appears.
 */
const SettingsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="m6.5 2.5 3 .01.4 1.6a4.6 4.6 0 0 1 1.2.7l1.56-.5 1.5 2.6-1.2 1a4.7 4.7 0 0 1 0 .8l1.2 1-1.5 2.6-1.56-.5a4.6 4.6 0 0 1-1.2.7l-.4 1.6-3 .01-.4-1.6a4.6 4.6 0 0 1-1.2-.7l-1.56.5-1.5-2.6 1.2-1a4.7 4.7 0 0 1 0-.8l-1.2-1 1.5-2.6 1.56.5a4.6 4.6 0 0 1 1.2-.7Z" />
    <circle cx="8" cy="8" r="1.7" />
  </svg>
)

export default SettingsIcon

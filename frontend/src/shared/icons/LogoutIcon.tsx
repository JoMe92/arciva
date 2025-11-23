import React from 'react'

const LogoutIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M11 6V5.2A2.2 2.2 0 0 0 8.8 3H6.6A2.6 2.6 0 0 0 4 5.6v12.8A2.6 2.6 0 0 0 6.6 21h2.2A2.2 2.2 0 0 0 11 18.8V18" />
    <path d="M14 8.5 18.5 12 14 15.5" />
    <path d="M18.5 12H9.5" />
  </svg>
)

export default LogoutIcon

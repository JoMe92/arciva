import React from 'react';
import StoneTrailIcon from '../StoneTrailIcon';

export interface ModalShellProps {
  title: string;
  onClose: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  headerRight?: React.ReactNode;
  footerLeft?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Provides a consistent shell for modal dialogues. It includes a
 * branded header, body content slot and footer with primary and
 * secondary actions. A backdrop darkens the rest of the page.
 */
const ModalShell: React.FC<ModalShellProps> = ({ title, onClose, onPrimary, primaryLabel, primaryDisabled, headerRight, footerLeft, children }) => {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/20">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)]">
              <StoneTrailIcon />
            </span>
            <div className="text-sm font-semibold">{title}</div>
          </div>
          {headerRight}
        </div>
        {children}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">{footerLeft}</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-8 rounded-full border border-[var(--border,#E1D3B9)] px-3 text-[12px]">
              Cancel
            </button>
            <button
              onClick={onPrimary}
              disabled={primaryDisabled}
              className={`h-8 rounded-full px-3 text-[12px] ${
                primaryDisabled
                  ? 'bg-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] cursor-not-allowed'
                  : 'bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)]'
              }`}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalShell;

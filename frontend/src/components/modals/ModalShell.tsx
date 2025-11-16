import React from 'react';

export interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  headerRight?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Provides a consistent shell for modal dialogues with a fixed header,
 * scrollable body and dedicated footer. Parents can pass their own
 * footer controls or rely on the default cancel/primary pair.
 */
const ModalShell: React.FC<ModalShellProps> = ({
  title,
  subtitle,
  onClose,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  headerRight,
  footerLeft,
  footerRight,
  children,
}) => {
  const renderFooterRight = () => {
    if (footerRight) return footerRight;
    if (!primaryLabel || !onPrimary) {
      return (
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[13px]"
        >
          Close
        </button>
      );
    }
    return (
      <>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[13px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className={`h-9 rounded-full px-4 text-[13px] transition-colors ${
            primaryDisabled
              ? 'cursor-not-allowed border border-[var(--border,#E1D3B9)] bg-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
              : 'border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]'
          }`}
        >
          {primaryLabel}
        </button>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4 py-6 sm:px-6">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border,#E1D3B9)] px-6 py-4">
          <div>
            <div className="text-base font-semibold text-[var(--text,#1F1E1B)]">{title}</div>
            {subtitle && <div className="text-[12px] text-[var(--text-muted,#6B645B)]">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-3">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)] hover:border-[var(--text-muted,#6B645B)]"
              aria-label="Close"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex flex-col gap-3 border-t border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 text-sm">{footerLeft}</div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">{renderFooterRight()}</div>
        </div>
      </div>
    </div>
  );
};

export default ModalShell;

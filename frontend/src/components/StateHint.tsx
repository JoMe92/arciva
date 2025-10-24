import React from 'react';
import StoneTrailIcon from './StoneTrailIcon';

export interface StateHintProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Displays a contextual hint when no projects match the current filters.
 * Optionally includes a call-to-action button to perform an action
 * such as clearing filters. The surrounding container is styled to
 * stand out against the page background.
 */
const StateHint: React.FC<StateHintProps> = ({ message, actionLabel, onAction }) => {
  return (
    <div className="my-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-white px-4 py-3 text-sm flex items-center gap-3">
      <StoneTrailIcon />
      <div className="flex-1 text-[var(--text,#1F1E1B)]">{message}</div>
      {actionLabel && (
        <button onClick={onAction} className="h-8 rounded-full border border-[var(--border,#E1D3B9)] px-3 text-[12px]">
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default StateHint;
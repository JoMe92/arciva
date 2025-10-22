import React from 'react';
import { motion } from 'framer-motion';
import StoneTrailIcon from './StoneTrailIcon';

/**
 * Splash screen displayed while demo assets are loading. It features
 * the StoneTrailIcon alongside descriptive text and uses Framer
 * Motion for a simple fade/slide animation.
 */
const Splash: React.FC = () => {
  return (
    <div className="fixed inset-0 grid place-items-center bg-[var(--surface-subtle,#FBF7EF)] text-[var(--text,#1F1E1B)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] shadow-sm">
          <StoneTrailIcon size={24} />
        </span>
        <div>
          <div className="text-base font-semibold tracking-tight">Loading your projects…</div>
          <div className="text-xs text-[var(--text-muted,#6B645B)]">Preparing key assets & presets</div>
        </div>
      </motion.div>
    </div>
  );
};

export default Splash;
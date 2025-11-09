import React from "react";
import { motion } from "framer-motion";

/**
 * Single loading mockup inspired by the placeholder design.
 *
 * Highlights:
 * - warm cream gradient surface
 * - rotating brown accent circle in the top-right
 * - static dark grey rounded loading bar in the lower left
 */

const tokens = {
  bgFrom: "#FFFAF2",
  bgTo: "#EDE1CC",
  accent: "#AF7356", // accent circle (brown)
  bar: "#514D48", // loading bar (dark grey)
  glow: "#C69A83",
};

export default function LoadingPlaceholderSpinner() {
  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundImage: `linear-gradient(135deg, ${tokens.bgFrom}, ${tokens.bgTo})` }}
    >
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">Platzhalter-orientierter Ladeentwurf – Hoch- & Querformat</h1>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Portrait layout */}
          <div
            className="relative overflow-hidden rounded-2xl p-5 shadow-sm aspect-[3/4]"
            style={{ backgroundImage: `linear-gradient(135deg, ${tokens.bgFrom}, ${tokens.bgTo})` }}
          >
            {/* rotating circle in the top-right */}
            <div className="absolute right-8 top-8 h-16 w-16" aria-hidden>
              <div className="absolute inset-2 rounded-full" style={{ backgroundColor: tokens.accent }} />
              <motion.div
                className="absolute inset-0 rounded-full border-[6px]"
                style={{ borderColor: tokens.accent, borderTopColor: tokens.glow, borderRightColor: "transparent" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
            </div>
            {/* stable bar in the lower-left, matching the placeholder proportions */}
            <div className="absolute bottom-8 left-8 w-[44%]">
              <div className="h-14 w-full rounded-full" style={{ backgroundColor: tokens.bar }} />
            </div>
          </div>

          {/* Landscape layout */}
          <div
            className="relative overflow-hidden rounded-2xl p-5 shadow-sm aspect-[16/9]"
            style={{ backgroundImage: `linear-gradient(135deg, ${tokens.bgFrom}, ${tokens.bgTo})` }}
          >
            {/* rotating circle in the top-right */}
            <div className="absolute right-8 top-8 h-16 w-16" aria-hidden>
              <div className="absolute inset-2 rounded-full" style={{ backgroundColor: tokens.accent }} />
              <motion.div
                className="absolute inset-0 rounded-full border-[6px]"
                style={{ borderColor: tokens.accent, borderTopColor: tokens.glow, borderRightColor: "transparent" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
            </div>
            {/* stable bar in the lower-left, scaled for landscape (longer) */}
            <div className="absolute bottom-8 left-8 w-[36%]">
              <div className="h-14 w-full rounded-full" style={{ backgroundColor: tokens.bar }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

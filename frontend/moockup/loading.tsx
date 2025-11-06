import React from "react";
import { motion } from "framer-motion";

/**
 * Einzelner Lade-Entwurf
 *
 * Angelehnt an den Platzhalter:
 * - Warmes Creme-Gradient als Fläche
 * - Brauner Akzent-Kreis oben rechts (hier dynamisch drehend)
 * - Dunkelgraue, stark abgerundete Leiste unten links – statisch
 */

const tokens = {
  bgFrom: "#FFFAF2",
  bgTo: "#EDE1CC",
  accent: "#AF7356", // Kreisfarbe (braun)
  bar: "#514D48", // Ladeleiste (dunkelgrau)
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
          {/* Hochformat */}
          <div
            className="relative overflow-hidden rounded-2xl p-5 shadow-sm aspect-[3/4]"
            style={{ backgroundImage: `linear-gradient(135deg, ${tokens.bgFrom}, ${tokens.bgTo})` }}
          >
            {/* Kreis oben rechts – drehend */}
            <div className="absolute right-8 top-8 h-16 w-16" aria-hidden>
              <div className="absolute inset-2 rounded-full" style={{ backgroundColor: tokens.accent }} />
              <motion.div
                className="absolute inset-0 rounded-full border-[6px]"
                style={{ borderColor: tokens.accent, borderTopColor: tokens.glow, borderRightColor: "transparent" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
            </div>
            {/* Stabiler Balken unten links – exakt wie im Placeholder (kürzer, stark abgerundet) */}
            <div className="absolute bottom-8 left-8 w-[44%]">
              <div className="h-14 w-full rounded-full" style={{ backgroundColor: tokens.bar }} />
            </div>
          </div>

          {/* Querformat */}
          <div
            className="relative overflow-hidden rounded-2xl p-5 shadow-sm aspect-[16/9]"
            style={{ backgroundImage: `linear-gradient(135deg, ${tokens.bgFrom}, ${tokens.bgTo})` }}
          >
            {/* Kreis oben rechts – drehend */}
            <div className="absolute right-8 top-8 h-16 w-16" aria-hidden>
              <div className="absolute inset-2 rounded-full" style={{ backgroundColor: tokens.accent }} />
              <motion.div
                className="absolute inset-0 rounded-full border-[6px]"
                style={{ borderColor: tokens.accent, borderTopColor: tokens.glow, borderRightColor: "transparent" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              />
            </div>
            {/* Stabiler Balken unten links – skaliert für Querformat (etwas länger) */}
            <div className="absolute bottom-8 left-8 w-[36%]">
              <div className="h-14 w-full rounded-full" style={{ backgroundColor: tokens.bar }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );ö
}

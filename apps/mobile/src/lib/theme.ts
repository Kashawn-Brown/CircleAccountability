// Central color palette. Every screen imports from here so palette
// tweaks happen in one place. Values roughly track Tailwind's slate
// and emerald scales so the dev-time hex lookups line up with
// anything we share with web later.

export const colors = {
  // Backgrounds
  bg: '#0f172a',           // slate-900 — main app background
  bgElevated: '#1e293b',   // slate-800 — input fields, cards

  // Borders
  border: '#334155',       // slate-700 — default border
  borderFocus: '#475569',  // slate-600 — focused border

  // Text
  text: '#f8fafc',         // slate-50  — primary text
  textMuted: '#94a3b8',    // slate-400 — secondary text / labels
  textFaint: '#64748b',    // slate-500 — placeholder / tertiary

  // Accents
  accent: '#059669',       // emerald-600 — primary action
  accentPressed: '#047857',// emerald-700 — pressed state

  // Status
  danger: '#ef4444',       // red-500 — error text
} as const;

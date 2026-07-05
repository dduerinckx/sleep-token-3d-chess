import type { Color } from "chess.js";

export type PieceLore = {
  name: string;
  song: string;
  role: string;
};

const WHITE_LORE: Record<string, PieceLore> = {
  k: { name: "Vessel", song: "The Summoning", role: "Masked sovereign upon the ritual throne" },
  q: { name: "Arcadia", song: "The Summoning", role: "Crowned emissary of the pale court" },
  b: { name: "High Priest", song: "Take Me Back to Eden", role: "Censer-bearing oracle of the mask" },
  n: { name: "The Chaser", song: "The Summoning", role: "Relentless hunter of the summoning rite" },
  r: { name: "Summoning Pillar", song: "Even in Arcadia", role: "Glyph-carved obelisk of worship" },
  p: { name: "Devotee", song: "The Summoning", role: "Kneeling soul sworn to the offering" },
};

const BLACK_LORE: Record<string, PieceLore> = {
  k: { name: "Eden King", song: "Back to Eden", role: "Vine-wrapped ruler of the overgrown court" },
  q: { name: "Lilith", song: "Back to Eden", role: "Serpent-crowned queen of reclaimed earth" },
  b: { name: "Serpent Priest", song: "Take Me Back to Eden", role: "Garden prophet of forbidden fruit" },
  n: { name: "Fallen Rider", song: "The Summoning", role: "Ash-maned knight of the final chase" },
  r: { name: "Overgrown Pillar", song: "Back to Eden", role: "Crumbling monument swallowed by ivy" },
  p: { name: "Lost Soul", song: "Back to Eden", role: "Wandering shade beneath Eden's canopy" },
};

export function getPieceLore(type: string, color: Color): PieceLore {
  const table = color === "w" ? WHITE_LORE : BLACK_LORE;
  return table[type] ?? table.p;
}

export const PROMOTION_LORE: Record<string, { white: string; black: string }> = {
  q: { white: "Ascend as Arcadia", black: "Ascend as Lilith" },
  r: { white: "Raise a Summoning Pillar", black: "Raise an Overgrown Pillar" },
  b: { white: "Crown a High Priest", black: "Crown a Serpent Priest" },
  n: { white: "Unleash The Chaser", black: "Unleash the Fallen Rider" },
};
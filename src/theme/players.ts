export type PlayerId = "kimberly" | "dorian";

export type PlayerProfile = {
  id: PlayerId;
  name: string;
  title: string;
  realm: string;
  color: "w" | "b";
  epithet: string;
  accent: string;
  glow: string;
};

export const PLAYERS: Record<PlayerId, PlayerProfile> = {
  kimberly: {
    id: "kimberly",
    name: "Kimberly",
    title: "Summoner of Arcadia",
    realm: "The Summoning",
    color: "w",
    epithet: "Pale ritual gold · mask-lit devotion",
    accent: "#e8d5a8",
    glow: "#c9a962",
  },
  dorian: {
    id: "dorian",
    name: "Dorian",
    title: "Keeper of Eden",
    realm: "Back to Eden",
    color: "b",
    epithet: "Vines & crimson · reclaimed throne",
    accent: "#7a9e6a",
    glow: "#8b3a4a",
  },
};

export function playerForColor(color: "w" | "b"): PlayerProfile {
  return color === "w" ? PLAYERS.kimberly : PLAYERS.dorian;
}
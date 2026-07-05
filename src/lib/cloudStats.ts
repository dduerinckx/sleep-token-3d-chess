import type { CareerStats } from "../game/StatsTracker";
import type { PlayerId } from "../theme/players";

const API = "/.netlify/functions/stats";

export async function fetchCloudStats(player: PlayerId): Promise<CareerStats | null> {
  try {
    const res = await fetch(`${API}?player=${player}`);
    if (!res.ok) return null;
    return (await res.json()) as CareerStats;
  } catch {
    return null;
  }
}

export async function saveCloudStats(player: PlayerId, stats: CareerStats): Promise<boolean> {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player, stats }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadAllCloudStats(): Promise<Partial<Record<PlayerId, CareerStats>>> {
  const [kimberly, dorian] = await Promise.all([fetchCloudStats("kimberly"), fetchCloudStats("dorian")]);
  return { kimberly: kimberly ?? undefined, dorian: dorian ?? undefined };
}
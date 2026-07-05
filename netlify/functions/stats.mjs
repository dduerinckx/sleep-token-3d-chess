import { getStore } from "@netlify/blobs";

const DEFAULT = {
  wins: 0,
  losses: 0,
  draws: 0,
  gamesPlayed: 0,
  killerMoves: 0,
  goodMoves: 0,
  badMoves: 0,
  fuckUps: 0,
};

export default async (req, context) => {
  const store = getStore("ritual-stats");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const player = url.searchParams.get("player");
    if (!player) {
      return new Response(JSON.stringify({ error: "player required" }), { status: 400 });
    }
    const raw = await store.get(player);
    const stats = raw ? JSON.parse(raw) : DEFAULT;
    return Response.json(stats);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const { player, stats } = body ?? {};
    if (!player || !stats) {
      return new Response(JSON.stringify({ error: "player and stats required" }), { status: 400 });
    }
    await store.set(player, JSON.stringify(stats));
    return Response.json({ ok: true });
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
};
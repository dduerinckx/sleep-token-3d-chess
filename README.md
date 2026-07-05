# Sleep Token 3D Chess (Multiplayer)

**Live:** https://sleep-token-3d-chess.netlify.app  
**Repo:** https://github.com/dduerinckx/sleep-token-3d-chess

Atmospheric 3D chess in the Sleep Token aesthetic — play solo or summon an opponent online via ritual room codes.

## Features

- **3D board** rendered with Three.js (void lighting, gold accents, floating pedestal)
- **Full chess rules** powered by `chess.js`
- **Online multiplayer** via PeerJS (host creates a code, guest joins — no backend required)
- **Solo mode** for local hot-seat play
- **Netlify-ready** static deployment

## Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Multiplayer

1. **Host** clicks *Create Game* and shares the ritual code (e.g. `ST-A3K9P2`)
2. **Guest** enters the code and clicks *Join*
3. Host plays White, Guest plays Black

Peer signaling uses the free [PeerServer Cloud](https://peerjs.com) — both players need an internet connection.

## Deploy to Netlify

```bash
npm run build
netlify deploy --prod
```

Or connect the GitHub repo in the Netlify dashboard for automatic deploys.

## Stack

- Vite + TypeScript
- Three.js
- chess.js
- PeerJS
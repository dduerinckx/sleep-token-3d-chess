import Peer, { type DataConnection } from "peerjs";

export type PlayerColor = "w" | "b";

export type NetMessage =
  | { type: "sync"; fen: string }
  | { type: "move"; from: string; to: string; promotion?: string }
  | { type: "chat"; text: string };

export type MultiplayerEvents = {
  onConnected?: (color: PlayerColor) => void;
  onDisconnected?: () => void;
  onMessage?: (msg: NetMessage) => void;
  onError?: (message: string) => void;
  onWaiting?: (roomCode: string) => void;
};

const PEER_CONFIG = {
  host: "0.peerjs.com",
  port: 443,
  path: "/",
  secure: true,
};

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export class MultiplayerSession {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private events: MultiplayerEvents;
  roomCode = "";
  role: "host" | "guest" | null = null;
  color: PlayerColor | null = null;

  constructor(events: MultiplayerEvents) {
    this.events = events;
  }

  async host(): Promise<string> {
    this.cleanup();
    this.role = "host";
    this.color = "w";
    this.roomCode = `ST-${randomCode()}`;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(this.roomCode, PEER_CONFIG);

      this.peer.on("open", () => {
        this.events.onWaiting?.(this.roomCode);
        resolve(this.roomCode);
      });

      this.peer.on("connection", (connection) => {
        this.attachConnection(connection);
        this.events.onConnected?.("w");
      });

      this.peer.on("error", (err) => {
        const msg = err.type === "unavailable-id" ? "Ritual code collision — try again." : err.message;
        this.events.onError?.(msg);
        reject(new Error(msg));
      });
    });
  }

  async join(code: string): Promise<void> {
    this.cleanup();
    this.role = "guest";
    this.color = "b";
    this.roomCode = code.trim().toUpperCase();

    const guestId = `${this.roomCode}-guest-${Date.now()}`;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(guestId, PEER_CONFIG);

      this.peer.on("open", () => {
        const connection = this.peer!.connect(this.roomCode, { reliable: true });
        this.attachConnection(connection);

        connection.on("open", () => {
          this.events.onConnected?.("b");
          resolve();
        });

        connection.on("error", () => {
          this.events.onError?.("Could not reach the host chamber.");
          reject(new Error("connection failed"));
        });
      });

      this.peer.on("error", (err) => {
        this.events.onError?.(err.message);
        reject(err);
      });
    });
  }

  send(msg: NetMessage): void {
    if (this.conn?.open) {
      this.conn.send(msg);
    }
  }

  cleanup(): void {
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
    this.role = null;
    this.color = null;
    this.roomCode = "";
  }

  private attachConnection(connection: DataConnection): void {
    if (this.conn?.open) return;
    this.conn = connection;

    connection.on("data", (data) => {
      this.events.onMessage?.(data as NetMessage);
    });

    connection.on("close", () => {
      this.events.onDisconnected?.();
    });
  }
}
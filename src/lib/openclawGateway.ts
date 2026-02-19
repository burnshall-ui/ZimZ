import { WebSocket } from "ws";
import { EventEmitter } from "events";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface GatewayFrame {
  type: "res" | "event";
  id?: string | number;
  ok?: boolean;
  payload?: unknown;
  error?: { message?: string; code?: number };
  event?: string;
  seq?: number;
  stateVersion?: number;
}

interface ConnectHelloPayload {
  type: "hello-ok";
  protocol: number;
  policy?: { tickIntervalMs?: number };
  auth?: { deviceToken?: string; role?: string; scopes?: string[] };
}

export interface GatewayEvent {
  event: string;
  payload: unknown;
  seq?: number;
  stateVersion?: number;
  receivedAt: number;
}

// ──────────────────────────────────────────────
// Config helpers
// ──────────────────────────────────────────────

const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const REQUEST_TIMEOUT_MS = 12_000;

function getGatewayUrl(): string {
  return process.env.OPENCLAW_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;
}

function getAuthParams(): Record<string, string> {
  if (process.env.OPENCLAW_GATEWAY_PASSWORD) {
    return { password: process.env.OPENCLAW_GATEWAY_PASSWORD };
  }
  return { token: process.env.OPENCLAW_GATEWAY_TOKEN ?? "" };
}

function makeRequestId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

interface DeviceIdentity {
  deviceId: string;
  privateKeyPem: string;
  publicKeyPem: string;
  token: string;
}

let cachedDeviceIdentity: DeviceIdentity | null | undefined;

function loadDeviceIdentity(): DeviceIdentity | null {
  if (cachedDeviceIdentity !== undefined) return cachedDeviceIdentity;
  try {
    const stateDir = process.env.OPENCLAW_STATE_DIR ?? path.join(process.env.HOME ?? "/home/canni", ".openclaw");
    const deviceJson = JSON.parse(fs.readFileSync(path.join(stateDir, "identity", "device.json"), "utf8"));
    const authJson = JSON.parse(fs.readFileSync(path.join(stateDir, "identity", "device-auth.json"), "utf8"));
    const token = authJson.tokens?.operator?.token ?? "";
    cachedDeviceIdentity = {
      deviceId: deviceJson.deviceId,
      privateKeyPem: deviceJson.privateKeyPem,
      publicKeyPem: deviceJson.publicKeyPem,
      token,
    };
    return cachedDeviceIdentity;
  } catch {
    cachedDeviceIdentity = null;
    return null;
  }
}

/** Build the connect params shared by one-shot and persistent connections */
function buildConnectParams(clientId: string, nonce?: string) {
  const role = "operator";
  const scopes = ["operator.admin"];
  const device = loadDeviceIdentity();

  const params: Record<string, unknown> = {
    minProtocol: 3,
    maxProtocol: 3,
    auth: getAuthParams(),
    client: {
      id: "gateway-client",
      platform: "linux",
      mode: "backend",
      version: "2026.2.17",
      instanceId: clientId,
    },
    role,
    scopes,
  };

  if (device) {
    const signedAtMs = Date.now();
    const payloadStr = [
      nonce ? "v2" : "v1",
      device.deviceId,
      "gateway-client",
      "backend",
      role,
      scopes.join(","),
      String(signedAtMs),
      device.token,
      ...(nonce ? [nonce] : []),
    ].join("|");
    const key = crypto.createPrivateKey(device.privateKeyPem);
    const signature = base64UrlEncode(crypto.sign(null, Buffer.from(payloadStr, "utf8"), key));
    const pubKeyDer = crypto.createPublicKey(device.publicKeyPem).export({ type: "spki", format: "der" });
    const pubKeyRaw = base64UrlEncode(pubKeyDer.subarray(-32));

    params.auth = { ...getAuthParams(), token: device.token };
    params.device = {
      id: device.deviceId,
      publicKey: pubKeyRaw,
      signature,
      signedAt: signedAtMs,
      ...(nonce ? { nonce } : {}),
    };
  }

  return params;
}

// ──────────────────────────────────────────────
// One-shot RPC (open → connect → call → close)
// Used by Next.js API routes for individual calls
// ──────────────────────────────────────────────

export async function callGatewayRpc<T = unknown>(
  method: string,
  params?: unknown,
): Promise<T> {
  const gatewayUrl = getGatewayUrl();
  const requestId = makeRequestId();

  return new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(gatewayUrl, {
      headers: { Origin: "http://localhost:3000" },
    });

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Gateway RPC timeout for method "${method}"`));
    }, REQUEST_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.removeAllListeners();
      ws.close();
    };

    ws.on("message", (raw) => {
      let msg: GatewayFrame;
      try {
        msg = JSON.parse(raw.toString()) as GatewayFrame;
      } catch {
        return;
      }

      // Step 1: Respond to connect.challenge
      if (msg.type === "event" && msg.event === "connect.challenge") {
        const nonce = (msg.payload as { nonce?: string })?.nonce;
        ws.send(
          JSON.stringify({
            type: "req",
            id: "connect",
            method: "connect",
            params: buildConnectParams("zimz-rpc", nonce),
          }),
        );
        return;
      }

      // Step 2: Handle connect response
      if (msg.id === "connect" && msg.type === "res") {
        if (msg.ok) {
          ws.send(
            JSON.stringify({
              type: "req",
              id: requestId,
              method,
              params: params ?? {},
            }),
          );
        } else {
          cleanup();
          reject(new Error(msg.error?.message ?? "Gateway authentication failed"));
        }
        return;
      }

      // Step 3: Handle RPC response
      if (msg.type === "res" && msg.id === requestId) {
        cleanup();
        if (msg.ok) {
          resolve((msg.payload ?? {}) as T);
        } else {
          reject(
            new Error(
              msg.error?.message ?? `Gateway RPC error for method "${method}"`,
            ),
          );
        }
        return;
      }
    });

    ws.on("error", (error) => {
      cleanup();
      reject(error);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
      reject(new Error(`Gateway connection closed unexpectedly during "${method}"`));
    });
  });
}

// ──────────────────────────────────────────────
// Fire-and-forget RPC (connect → send → close, no response needed)
// Used for methods like cron.run that don't send a response frame
// ──────────────────────────────────────────────

export async function fireGatewayRpc(
  method: string,
  params?: unknown,
): Promise<void> {
  const gatewayUrl = getGatewayUrl();
  const requestId = makeRequestId();

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(gatewayUrl, {
      headers: { Origin: "http://localhost:3000" },
    });

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Gateway connect timeout for method "${method}"`));
    }, REQUEST_TIMEOUT_MS);

    ws.on("message", (raw) => {
      let msg: GatewayFrame;
      try {
        msg = JSON.parse(raw.toString()) as GatewayFrame;
      } catch {
        return;
      }

      if (msg.type === "event" && msg.event === "connect.challenge") {
        const nonce = (msg.payload as { nonce?: string })?.nonce;
        ws.send(
          JSON.stringify({
            type: "req",
            id: "connect",
            method: "connect",
            params: buildConnectParams("zimz-rpc-fire", nonce),
          }),
        );
        return;
      }

      if (msg.id === "connect" && msg.type === "res") {
        if (msg.ok) {
          ws.send(
            JSON.stringify({
              type: "req",
              id: requestId,
              method,
              params: params ?? {},
            }),
          );
          // Resolve immediately after sending — no response expected
          clearTimeout(timeout);
          setTimeout(() => ws.close(), 500);
          resolve();
        } else {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error?.message ?? "Gateway authentication failed"));
        }
        return;
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
      reject(new Error(`Gateway connection closed unexpectedly during "${method}"`));
    });
  });
}

// ──────────────────────────────────────────────
// Persistent Gateway connection for event streaming
// Singleton per Node.js process (works with `next start`)
// ──────────────────────────────────────────────

class GatewayEventManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private helloPayload: ConnectHelloPayload | null = null;

  /** Connect to the Gateway and start receiving events */
  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const gatewayUrl = getGatewayUrl();
    console.log("[GatewayEvents] Connecting to", gatewayUrl);

    this.ws = new WebSocket(gatewayUrl, {
      headers: { Origin: "http://localhost:3000" },
    });

    this.ws.on("message", (raw) => {
      let msg: GatewayFrame;
      try {
        msg = JSON.parse(raw.toString()) as GatewayFrame;
      } catch {
        return;
      }

      // Handshake: respond to connect.challenge
      if (msg.type === "event" && msg.event === "connect.challenge") {
        const nonce = (msg.payload as { nonce?: string })?.nonce;
        this.ws?.send(
          JSON.stringify({
            type: "req",
            id: "connect",
            method: "connect",
            params: buildConnectParams("zimz-events", nonce),
          }),
        );
        return;
      }

      // Handshake: handle hello-ok
      if (msg.id === "connect" && msg.type === "res") {
        if (msg.ok) {
          this.connected = true;
          this.helloPayload = (msg.payload ?? null) as ConnectHelloPayload | null;
          console.log(
            "[GatewayEvents] Connected (protocol",
            this.helloPayload?.protocol ?? "?",
            ")",
          );
          this.emit("connected", this.helloPayload);
        } else {
          console.error("[GatewayEvents] Auth failed:", msg.error?.message);
          this.emit("auth-error", msg.error);
        }
        return;
      }

      // Forward all Gateway events to listeners
      if (msg.type === "event" && msg.event) {
        const evt: GatewayEvent = {
          event: msg.event,
          payload: msg.payload,
          seq: msg.seq,
          stateVersion: msg.stateVersion,
          receivedAt: Date.now(),
        };
        this.emit("gateway-event", evt);
        this.emit(`gw:${msg.event}`, evt);
      }
    });

    this.ws.on("error", (err) => {
      console.error("[GatewayEvents] WebSocket error:", err.message);
    });

    this.ws.on("close", (code, reason) => {
      console.log("[GatewayEvents] Disconnected:", code, reason?.toString());
      this.connected = false;
      this.ws = null;
      this.emit("disconnected", { code, reason: reason?.toString() });
      this.scheduleReconnect();
    });
  }

  /** Disconnect and stop reconnecting */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /** Send an RPC request over the persistent connection */
  async call<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || !this.connected) {
      throw new Error("Gateway event connection not established");
    }

    const requestId = makeRequestId();

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Gateway call timeout for "${method}"`));
      }, REQUEST_TIMEOUT_MS);

      const handler = (raw: Buffer | string) => {
        let msg: GatewayFrame;
        try {
          msg = JSON.parse(raw.toString()) as GatewayFrame;
        } catch {
          return;
        }

        if (msg.type === "res" && msg.id === requestId) {
          clearTimeout(timeout);
          this.ws?.removeListener("message", handler);
          if (msg.ok) {
            resolve((msg.payload ?? {}) as T);
          } else {
            reject(new Error(msg.error?.message ?? `RPC error: ${method}`));
          }
        }
      };

      this.ws!.on("message", handler);
      this.ws!.send(
        JSON.stringify({
          type: "req",
          id: requestId,
          method,
          params: params ?? {},
        }),
      );
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  getHelloPayload(): ConnectHelloPayload | null {
    return this.helloPayload;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log("[GatewayEvents] Reconnecting in 5s...");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }
}

// Singleton – survives across API route invocations in `next start`
export const gatewayEvents = new GatewayEventManager();

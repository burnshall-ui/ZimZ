import { WebSocket } from "ws";

interface GatewayMessage {
  type: "res" | "event";
  id?: string | number;
  ok?: boolean;
  payload?: unknown;
  error?: { message?: string; code?: number };
  event?: string;
}

const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const DEFAULT_GATEWAY_PASSWORD = "REDACTED_PASSWORD";
const REQUEST_TIMEOUT_MS = 12_000;

export async function callGatewayRpc<T = unknown>(
  method: string,
  params?: unknown,
): Promise<T> {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;
  const gatewayPassword = process.env.OPENCLAW_GATEWAY_PASSWORD ?? DEFAULT_GATEWAY_PASSWORD;
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(gatewayUrl, {
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });
    let authenticated = false;
    let challengeNonce: string | null = null;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Gateway RPC timeout for method "${method}"`));
    }, REQUEST_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.removeAllListeners();
      ws.close();
    };

    const sendRequest = () => {
      ws.send(
        JSON.stringify({
          type: "req",
          id: requestId,
          method,
          params: params ?? {},
        }),
      );
    };

    ws.on("message", (raw) => {
      let msg: GatewayMessage;
      try {
        msg = JSON.parse(raw.toString()) as GatewayMessage;
      } catch {
        return;
      }

      // Handle connect.challenge event
      if (msg.type === "event" && msg.event === "connect.challenge") {
        const payload = msg.payload as { nonce?: string };
        challengeNonce = payload?.nonce ?? null;

        // Respond with connect request (correct format)
        ws.send(
          JSON.stringify({
            type: "req",
            id: "connect",
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "test",
                platform: "linux",
                mode: "test",
                version: "2026.2.9",
              },
              role: "operator",
            },
          }),
        );
        return;
      }

      // Handle connect response
      if (msg.id === "connect" && msg.type === "res") {
        if (msg.ok) {
          authenticated = true;
          sendRequest();
        } else {
          cleanup();
          reject(new Error(msg.error?.message ?? "Gateway authentication failed"));
        }
        return;
      }

      // Handle actual RPC response
      if (msg.type === "res" && msg.id === requestId) {
        if (msg.ok) {
          cleanup();
          resolve((msg.payload ?? {}) as T);
        } else if (msg.error) {
          cleanup();
          reject(
            new Error(
              msg.error.message ?? `Gateway RPC error for method "${method}"`,
            ),
          );
        } else {
          cleanup();
          reject(new Error(`Invalid response for method "${method}"`));
        }
        return;
      }

      // Ignore other events
    });

    ws.on("error", (error) => {
      cleanup();
      reject(error);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
    });
  });
}

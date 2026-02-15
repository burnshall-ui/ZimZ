import { WebSocket } from "ws";

interface GatewayRpcResponse<T = unknown> {
  id?: string | number;
  result?: T;
  error?: { message?: string; code?: number; data?: unknown };
}

const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const REQUEST_TIMEOUT_MS = 12_000;

export async function callGatewayRpc<T = unknown>(
  method: string,
  params?: unknown,
): Promise<T> {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  const wsUrl = `${gatewayUrl}${gatewayToken ? `?token=${gatewayToken}` : ''}`;
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Gateway RPC timeout for method "${method}"`));
    }, REQUEST_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.removeAllListeners();
      ws.close();
    };

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          id: requestId,
          method,
          params: params ?? {},
        }),
      );
    });

    ws.on("message", (raw) => {
      let payload: GatewayRpcResponse<T>;
      try {
        payload = JSON.parse(raw.toString()) as GatewayRpcResponse<T>;
      } catch {
        return;
      }

      if (payload.id !== requestId) return;

      if (payload.error) {
        cleanup();
        reject(
          new Error(
            payload.error.message ?? `Gateway RPC error for method "${method}"`,
          ),
        );
        return;
      }

      cleanup();
      resolve((payload.result ?? ({} as T)) as T);
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

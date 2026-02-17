import { gatewayEvents, type GatewayEvent } from "@/src/lib/openclawGateway";

export const runtime = "nodejs";
// Disable response buffering for SSE
export const dynamic = "force-dynamic";

// ──────────────────────────────────────────────
// GET /api/events → Server-Sent Events stream
// Connects the persistent Gateway WS and forwards events
// ──────────────────────────────────────────────

export async function GET() {
  // Ensure the singleton Gateway event connection is alive
  gatewayEvents.connect();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection status
      const sendSSE = (eventType: string, data: unknown) => {
        try {
          const payload = JSON.stringify(data);
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${payload}\n\n`),
          );
        } catch {
          // Stream may be closed
        }
      };

      // Heartbeat to keep connection alive (every 15s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // Send current connection status immediately
      sendSSE("status", {
        connected: gatewayEvents.isConnected(),
        hello: gatewayEvents.getHelloPayload(),
        ts: Date.now(),
      });

      // Forward Gateway events to SSE
      const onGatewayEvent = (evt: GatewayEvent) => {
        sendSSE("gateway", evt);
      };

      // Connection lifecycle events
      const onConnected = (hello: unknown) => {
        sendSSE("status", { connected: true, hello, ts: Date.now() });
      };

      const onDisconnected = (info: unknown) => {
        sendSSE("status", { connected: false, info, ts: Date.now() });
      };

      const onAuthError = (err: unknown) => {
        sendSSE("error", { type: "auth", error: err, ts: Date.now() });
      };

      // Subscribe to all events
      gatewayEvents.on("gateway-event", onGatewayEvent);
      gatewayEvents.on("connected", onConnected);
      gatewayEvents.on("disconnected", onDisconnected);
      gatewayEvents.on("auth-error", onAuthError);

      // Cleanup when client disconnects
      const cleanup = () => {
        clearInterval(heartbeat);
        gatewayEvents.off("gateway-event", onGatewayEvent);
        gatewayEvents.off("connected", onConnected);
        gatewayEvents.off("disconnected", onDisconnected);
        gatewayEvents.off("auth-error", onAuthError);
      };

      // Handle stream cancellation
      controller.close = new Proxy(controller.close, {
        apply(target, thisArg, args) {
          cleanup();
          return Reflect.apply(target, thisArg, args);
        },
      });

      // Also handle abort via request signal (Next.js uses this)
      // The stream will be cancelled when the client disconnects
    },

    cancel() {
      // Client disconnected — cleanup happens via the Proxy above
      // or we can do additional cleanup here if needed
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

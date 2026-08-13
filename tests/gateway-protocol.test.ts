import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// buildConnectParams is module-private and only reachable through a live
// WebSocket handshake, so this asserts against the source directly. It is a
// blunt check, but it is the one that would have caught the outage: the
// Gateway accepts a connection only when maxProtocol >= 4 && minProtocol <= 4,
// and ZimZ shipped minProtocol: 3, maxProtocol: 3 for long enough that every
// RPC failed for two days without anyone noticing.
const source = readFileSync(
  path.join(import.meta.dirname, "..", "src", "lib", "openclawGateway.ts"),
  "utf8",
);

const numericField = (name: string): number => {
  const match = source.match(new RegExp(`${name}:\\s*(\\d+)`));
  expect(match, `${name} not found in openclawGateway.ts`).not.toBeNull();
  return Number(match![1]);
};

describe("Gateway protocol negotiation", () => {
  it("offers a range the current Gateway accepts", () => {
    const min = numericField("minProtocol");
    const max = numericField("maxProtocol");

    expect(max).toBeGreaterThanOrEqual(4);
    expect(min).toBeLessThanOrEqual(4);
  });

  it("still reaches back to older Gateways", () => {
    expect(numericField("minProtocol")).toBeLessThanOrEqual(3);
  });

  it("does not hardcode a foreign home directory", () => {
    // The device identity path used to fall back to /home/canni.
    expect(source).not.toMatch(/\/home\/[a-z]+/);
  });
});

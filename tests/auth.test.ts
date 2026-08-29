import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";

describe("lösenordshantering (scrypt)", () => {
  it("hashar och verifierar korrekt lösenord", async () => {
    const hash = await hashPassword("hemligt-losenord-123");
    expect(hash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(await verifyPassword("hemligt-losenord-123", hash)).toBe(true);
  });

  it("avvisar fel lösenord", async () => {
    const hash = await hashPassword("hemligt-losenord-123");
    expect(await verifyPassword("fel-losenord", hash)).toBe(false);
  });

  it("två hashar av samma lösenord är olika (unika salter)", async () => {
    const a = await hashPassword("samma");
    const b = await hashPassword("samma");
    expect(a).not.toBe(b);
  });

  it("kraschar inte på trasig lagrad hash", async () => {
    expect(await verifyPassword("x", "trasig")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("rate limiting", () => {
  it("släpper igenom upp till gränsen och blockerar sedan", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, { limit: 5, windowMs: 60_000 }).ok).toBe(true);
    }
    const blocked = rateLimit(key, { limit: 5, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("olika nycklar räknas separat", () => {
    const a = `a-${Date.now()}`;
    const b = `b-${Date.now()}`;
    for (let i = 0; i < 3; i++) rateLimit(a, { limit: 3, windowMs: 60_000 });
    expect(rateLimit(a, { limit: 3, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit(b, { limit: 3, windowMs: 60_000 }).ok).toBe(true);
  });
});

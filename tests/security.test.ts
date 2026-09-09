import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isSafeImageRef, IMAGE_REF_RE } from "@/lib/media";
import { isFirstPartyNavigation } from "@/lib/auth/request-guard";
import { csvCell } from "@/lib/csv";
import { redactSensitiveText, redactSentryEvent } from "@/lib/sentry-redact";
import { authorizeCron } from "@/lib/cron-auth";
import { hashIp } from "@/lib/polls/service";
import { proxy } from "@/proxy";
import { sameOrigin } from "@/lib/polls/visitor";

describe("bildreferens", () => {
  it("tillåter bara /images/<namn>.jpg|png|webp", () => {
    expect(isSafeImageRef("/images/kolasnittar.jpg")).toBe(true);
    expect(isSafeImageRef("/images/hallongrotta-og.jpg")).toBe(true);
    expect(isSafeImageRef("/images/foo.webp")).toBe(true);
    expect(isSafeImageRef("/images/foo.PNG")).toBe(false);
    expect(isSafeImageRef("/images/../etc/passwd")).toBe(false);
    expect(isSafeImageRef("/faktura/abc")).toBe(false);
    expect(isSafeImageRef("https://evil.example/x.jpg")).toBe(false);
    expect(isSafeImageRef("//evil.example/x.jpg")).toBe(false);
    expect(isSafeImageRef("/images/foo.jpg?x=1")).toBe(false);
    expect(isSafeImageRef("")).toBe(false);
    expect(IMAGE_REF_RE.test("/images/ok.png")).toBe(true);
  });
});

describe("förstapartsnedladdning (admin GET)", () => {
  it("avvisar cross-site och same-site", () => {
    expect(isFirstPartyNavigation(new Headers({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isFirstPartyNavigation(new Headers({ "sec-fetch-site": "same-site" }))).toBe(false);
  });
  it("släpper same-origin, none och saknad site utan referer", () => {
    expect(isFirstPartyNavigation(new Headers({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isFirstPartyNavigation(new Headers({ "sec-fetch-site": "none" }))).toBe(true);
    expect(isFirstPartyNavigation(new Headers())).toBe(true);
  });
  it("avvisar främmande Referer när Sec-Fetch-Site saknas", () => {
    expect(
      isFirstPartyNavigation(new Headers({ referer: "https://evil.example/x", host: "sockerbagaren.se" }))
    ).toBe(false);
    expect(
      isFirstPartyNavigation(new Headers({ referer: "https://sockerbagaren.se/admin", host: "sockerbagaren.se" }))
    ).toBe(true);
  });
});

describe("CSV-formelinjektion", () => {
  it("prefixar = + - @ så Excel inte kör dem", () => {
    expect(csvCell('=HYPERLINK("http://evil")').startsWith("\"'=")).toBe(true);
    expect(csvCell("+cmd").includes("'+cmd") || csvCell("+cmd").startsWith("'+")).toBe(true);
    expect(csvCell("Fikabolaget AB")).toBe("Fikabolaget AB");
    expect(csvCell("-2+3").includes("'-2+3")).toBe(true);
    expect(csvCell("@SUM(A1)").includes("'@SUM")).toBe(true);
  });
  it("citerar celler med semikolon och citattecken", () => {
    expect(csvCell('Bolag "AB";')).toBe('"Bolag ""AB"";"');
  });
});

describe("Sentry-redaktion", () => {
  it("maskar faktura- och hanteringstoken samt Bearer", () => {
    const token = "a".repeat(48);
    expect(redactSensitiveText(`https://sockerbagaren.se/faktura/${token}`)).toBe(
      "https://sockerbagaren.se/faktura/[redacted]"
    );
    expect(redactSensitiveText(`/prenumeration/hantera/${token}`)).toBe("/prenumeration/hantera/[redacted]");
    expect(redactSensitiveText("Authorization: Bearer hemlig-nyckel")).toBe("Authorization: Bearer [redacted]");
  });
  it("tar bort cookie- och auth-huvuden från event.request", () => {
    const event = redactSentryEvent({
      request: {
        url: `https://x/faktura/${"b".repeat(48)}`,
        cookies: { a: "1" },
        headers: { Cookie: "sb=1", authorization: "Bearer x", Accept: "text/html" },
      },
    });
    const req = event.request as Record<string, unknown>;
    expect(req.url).toContain("[redacted]");
    expect(req.cookies).toBeUndefined();
    const headers = req.headers as Record<string, unknown>;
    expect(headers.Cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(headers.Accept).toBe("text/html");
  });
});

describe("cron-auth", () => {
  const url = "http://localhost/api/cron/lock-delivery-weeks";
  const prev = process.env.CRON_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });
  it("503 utan hemlighet, 401 med fel, null med rätt", () => {
    delete process.env.CRON_SECRET;
    const denied = authorizeCron(new NextRequest(url));
    expect(denied?.status).toBe(503);
    process.env.CRON_SECRET = "unit-cron";
    expect(authorizeCron(new NextRequest(url, { headers: { authorization: "Bearer fel" } }))?.status).toBe(401);
    expect(authorizeCron(new NextRequest(url, { headers: { authorization: "Bearer unit-cron" } }))).toBeNull();
  });
});

describe("hashIp", () => {
  const prevSalt = process.env.POLL_IP_SALT;
  const prevCron = process.env.CRON_SECRET;
  afterEach(() => {
    if (prevSalt === undefined) delete process.env.POLL_IP_SALT;
    else process.env.POLL_IP_SALT = prevSalt;
    if (prevCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCron;
  });
  it("returnerar tomt utan salt – aldrig en publik fallback", () => {
    delete process.env.POLL_IP_SALT;
    delete process.env.CRON_SECRET;
    expect(hashIp("1.2.3.4")).toBe("");
  });
  it("är stabil, 32 hex, och inte rå IP", () => {
    process.env.POLL_IP_SALT = "unit-salt";
    const a = hashIp("1.2.3.4");
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(a).toBe(hashIp("1.2.3.4"));
    expect(a).not.toBe(hashIp("1.2.3.5"));
    expect(a.includes("1.2.3.4")).toBe(false);
  });
});

describe("poll sameOrigin", () => {
  it("avvisar cross-site", () => {
    const req = new NextRequest("http://localhost/api/polls/x/vote", {
      headers: { origin: "https://evil.example", host: "localhost", "sec-fetch-site": "cross-site" },
    });
    expect(sameOrigin(req)).toBe(false);
  });
  it("släpper same-origin", () => {
    const req = new NextRequest("http://localhost/api/polls/x/vote", {
      headers: { origin: "http://localhost", host: "localhost", "sec-fetch-site": "same-origin" },
    });
    expect(sameOrigin(req)).toBe(true);
  });
});

describe("proxy: demo-underlag i produktion", () => {
  const prev = process.env.VERCEL_ENV;
  afterEach(() => {
    if (prev === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev;
  });
  it("404:ar /demo-underlag när VERCEL_ENV=production", async () => {
    process.env.VERCEL_ENV = "production";
    const res = proxy(new NextRequest("https://sockerbagaren.se/demo-underlag/faktura-10001.pdf"));
    expect(res.status).toBe(404);
  });
  it("släpper vägen i preview (filen kan saknas – då 404:ar Next, inte proxyn)", () => {
    process.env.VERCEL_ENV = "preview";
    const res = proxy(new NextRequest("https://sockerbagaren.se/demo-underlag/faktura-10001.pdf"));
    expect(res.status).not.toBe(404);
  });
});

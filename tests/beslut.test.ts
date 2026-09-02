import { beforeAll, describe, expect, it, vi, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/create-order";
import { issueCreditNote, remainingByLine, CreditError } from "@/lib/invoice/credit";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { allergenChips, highlightAllergens } from "@/lib/allergens";
import { foodVatNotice, FOOD_VAT_RATE_BP } from "@/lib/vat";
import { addDays, toISODate, upcomingDeliveryDates } from "@/lib/dates";
import { invoiceConfig } from "@/lib/config";
import { checkoutSchema } from "@/lib/validation";
import type { CheckoutInput } from "@/lib/validation";
import { orgNumber } from "./helpers";

// Regressionstester för beslutsomgången: förfallodag från leverans,
// delkreditering, livsmedelsmoms, allergener, robotskydd.

let products: { id: string; name: string; pricePerKgOre: number; vatRateBp: number; unit: string }[] = [];
let validDate = "";
let n = 0;

function input(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  n++;
  return {
    items: [{ productId: products[0].id, weightKg: 3 }, { productId: products[1].id, weightKg: 2 }],
    areaSlug: "tyreso",
    deliveryDate: validDate,
    companyName: "Beslutsbolaget AB",
    orgNumber: orgNumber("556700000"),
    contactName: "Test Person",
    email: `beslut${n}@example.com`,
    phone: "070-123 45 67",
    deliveryAddress: "Testgatan 1",
    deliveryPostalCode: "135 48",
    deliveryCity: "Tyresö",
    deliveryInstruction: "",
    invoiceEmail: `beslut${n}@example.com`,
    reference: "",
    billingAddress: "",
    ...overrides,
  };
}

beforeAll(async () => {
  products = await prisma.product.findMany({ where: { active: true, unit: "kg" }, orderBy: { sortOrder: "asc" } });
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
  validDate = toISODate(
    upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 1)[0]
  );
});

describe("förfallodag", () => {
  it("räknas från leveransdagen, inte fakturadatumet", async () => {
    const { order, invoice } = await createOrder(input(), { skipEmails: true });
    expect(toISODate(invoice.dueDate)).toBe(toISODate(addDays(order.deliveryDate, invoiceConfig.paymentTermsDays)));
    const snapshot = parseSnapshot(invoice.snapshotJson);
    expect(snapshot.dueDate).toBe(toISODate(invoice.dueDate));
    expect(snapshot.dueDate > snapshot.deliveryDate).toBe(true);
  });
});

describe("livsmedelsmoms", () => {
  it("sortimentet ligger på 6 % och ordern räknar med produktens sats", async () => {
    expect(products.every((p) => p.vatRateBp === FOOD_VAT_RATE_BP)).toBe(true);
    const { order } = await createOrder(input({ items: [{ productId: products[0].id, weightKg: 1 }] }), { skipEmails: true });
    expect(order.vatOre).toBe(Math.round((products[0].pricePerKgOre * 600) / 10000));
  });
  it("påminner admin om att satsen är tillfällig", () => {
    expect(foodVatNotice("2026-09-02", 4)?.urgent).toBe(false);
    expect(foodVatNotice("2027-12-15", 4)?.urgent).toBe(true);
    expect(foodVatNotice("2028-01-02", 1)?.text).toMatch(/upphörde/);
    expect(foodVatNotice("2026-09-02", 0)).toBeNull();
  });
});

describe("delkreditering", () => {
  it("krediterar valda rader, minskar återstående, stänger fakturan när allt är krediterat", async () => {
    const { invoice } = await createOrder(input(), { skipEmails: true });
    const p0 = products[0];
    const p1 = products[1];

    // 1 kg av rad 0
    const partial = await issueCreditNote(invoice.id, "test", { lines: [{ lineIndex: 0, qty: 1 }], reason: "Saknad vikt" });
    expect(partial?.kind).toBe("PARTIAL");
    const expectedNet = p0.pricePerKgOre;
    expect(partial!.subtotalOre).toBe(-expectedNet);
    expect(partial!.totalOre).toBe(-(expectedNet + Math.round((expectedNet * p0.vatRateBp) / 10000)));
    const snap = parseSnapshot(partial!.snapshotJson);
    expect(snap.creditKind).toBe("PARTIAL");
    expect(snap.creditReason).toBe("Saknad vikt");
    expect(snap.lines).toHaveLength(1);
    expect(snap.lines[0].sourceLineIndex).toBe(0);
    const pdf = await renderInvoicePdf(snap, partial!.creditNumber);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");

    let inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { creditNotes: true } });
    expect(inv.status).toBe("UNPAID");
    const remaining = remainingByLine(inv.snapshotJson, inv.creditNotes);
    expect(remaining.map((r) => r.remaining)).toEqual([2, 2]);

    // För mycket på rad 0 avvisas
    await expect(issueCreditNote(invoice.id, "test", { lines: [{ lineIndex: 0, qty: 3 }] })).rejects.toBeInstanceOf(CreditError);
    // Ogiltig rad avvisas
    await expect(issueCreditNote(invoice.id, "test", { lines: [{ lineIndex: 7, qty: 1 }] })).rejects.toBeInstanceOf(CreditError);

    // Resten: hel kreditering krediterar bara det som återstår
    const full = await issueCreditNote(invoice.id, "test");
    expect(full?.kind).toBe("FULL");
    const restNet = 2 * p0.pricePerKgOre + 2 * p1.pricePerKgOre;
    expect(full!.subtotalOre).toBe(-restNet);
    inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { creditNotes: true } });
    expect(inv.status).toBe("CREDITED");
    expect(inv.creditNotes).toHaveLength(2);
    // Summan av alla kreditfakturor = hela fakturan
    expect(inv.creditNotes.reduce((s, c) => s + c.subtotalOre, 0)).toBe(-inv.subtotalOre);
    expect(remainingByLine(inv.snapshotJson, inv.creditNotes).every((r) => r.remaining === 0)).toBe(true);

    // Idempotent: ny hel kreditering returnerar den befintliga, ingen ny
    const again = await issueCreditNote(invoice.id, "test");
    expect(again!.id).toBe(full!.id);
    await expect(issueCreditNote(invoice.id, "test", { lines: [{ lineIndex: 1, qty: 1 }] })).rejects.toBeInstanceOf(CreditError);
    expect(Number(full!.creditNumber)).toBeGreaterThan(Number(partial!.creditNumber));
  });
});

describe("allergener", () => {
  it("delar 'mandel och soja' i två spår-chips", () => {
    expect(allergenChips("Innehåller vete, smör (mjölk). Kan innehålla spår av mandel och soja.")).toEqual([
      "Vete",
      "Smör (mjölk)",
      "Mandel (spår)",
      "Soja (spår)",
    ]);
  });
  it("markerar soja i ingredienser", () => {
    const seg = highlightAllergens("choklad (sojalecitin), salt");
    expect(seg.filter((s) => s.allergen).map((s) => s.text)).toEqual(["sojalecitin"]);
  });
});

describe("robotskydd (Turnstile)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("valideringen accepterar token-fältet", () => {
    const r = checkoutSchema.safeParse({ ...input(), idempotencyKey: "abcdefghijklmnop1234", turnstileToken: "tok" });
    expect(r.success).toBe(true);
  });

  it("utan nycklar är verifieringen en no-op", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const mod = await import("@/lib/turnstile");
    expect(mod.turnstileEnabled()).toBe(false);
    expect((await mod.verifyTurnstile(undefined, null)).ok).toBe(true);
  });

  it("med nycklar: saknad token avvisas, success:false avvisas, success:true släpps igenom, nätverksfel släpper igenom", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    const mod = await import("@/lib/turnstile");
    expect(mod.turnstileEnabled()).toBe(true);
    expect((await mod.verifyTurnstile(undefined, "1.2.3.4")).ok).toBe(false);

    const calls: { body: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
        calls.push({ body: init.body.toString() });
        const ok = init.body.get("response") === "good";
        return new Response(JSON.stringify({ success: ok, "error-codes": ok ? [] : ["invalid-input-response"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    expect((await mod.verifyTurnstile("good", "1.2.3.4")).ok).toBe(true);
    expect(calls[0].body).toContain("remoteip=1.2.3.4");
    const bad = await mod.verifyTurnstile("bad", null);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("invalid-input-response");

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ENOTFOUND"); }));
    expect((await mod.verifyTurnstile("good", null)).ok).toBe(true);
  });

  it("clientIp tar första hoppet i x-forwarded-for", async () => {
    const mod = await import("@/lib/turnstile");
    expect(mod.clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(mod.clientIp(new Headers())).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { looksLikePersonalNumber, isValidOrgNumber } from "@/lib/validation";
import { safeBlockedDates } from "@/lib/products";

describe("personnummer-flagga i admin", () => {
  it("flaggar personnummerformat men inte aktiebolag", () => {
    expect(looksLikePersonalNumber("559141-7042")).toBe(false); // Landvex AB
    expect(looksLikePersonalNumber("556000-0002")).toBe(false);
    expect(looksLikePersonalNumber("850101-1234")).toBe(true); // ÅÅMMDD
    expect(looksLikePersonalNumber("9912310000")).toBe(true);
    expect(looksLikePersonalNumber("12345")).toBe(false);
  });

  it("rör inte Luhn-kontrollen", () => {
    expect(isValidOrgNumber("559141-7042")).toBe(true);
  });
});

describe("spärrade datum från databasen", () => {
  it("släpper bara igenom giltiga ISO-datum", () => {
    expect(safeBlockedDates('["2026-12-17","fel","2026-1-1",5]')).toEqual(["2026-12-17"]);
    expect(safeBlockedDates("trasig json")).toEqual([]);
    expect(safeBlockedDates("[]")).toEqual([]);
  });
});

// ---------- Avbokningsgräns, kapacitet ----------
import { changeDeadline, formatDeadline, fromISODate, isWorkday, stockholmTime } from "@/lib/dates";
import { lineKg, totalKg } from "@/lib/orders/capacity";
import { prisma } from "@/lib/db";
import { createOrder, OrderError } from "@/lib/orders/create-order";
import { toISODate, upcomingDeliveryDates } from "@/lib/dates";
import { orgNumber } from "./helpers";

describe("ändringsgräns per order", () => {
  it("två arbetsdagar före torsdag kl 12 = tisdag kl 12 svensk tid", () => {
    const d = changeDeadline(fromISODate("2026-09-10"), 2, 12);
    // Sommartid: 12:00 Stockholm = 10:00 UTC
    expect(d.toISOString()).toBe("2026-09-08T10:00:00.000Z");
    expect(formatDeadline(d)).toBe("tisdag 8 september kl. 12.00");
  });
  it("hoppar över helg och helgdag", () => {
    // Måndag 18 maj 2026: fredag 15 maj är klämdag (arbetsdag), torsdag 14 maj är Kristi himmelsfärd.
    expect(toISODate(changeDeadline(fromISODate("2026-05-18"), 2, 12))).toBe("2026-05-13");
    // Måndag: två arbetsdagar tillbaka = torsdag föregående vecka.
    expect(toISODate(changeDeadline(fromISODate("2026-09-14"), 2, 12))).toBe("2026-09-10");
    expect(isWorkday(fromISODate("2026-09-12"))).toBe(false); // lördag
    expect(isWorkday(fromISODate("2026-06-06"))).toBe(false); // nationaldagen
  });
  it("vintertid: 12:00 Stockholm = 11:00 UTC", () => {
    expect(stockholmTime(fromISODate("2026-12-15"), 12).toISOString()).toBe("2026-12-15T11:00:00.000Z");
  });
});

describe("kapacitet per leveransdag", () => {
  it("räknar lösvikt rakt av och paket via paketvikt", () => {
    expect(lineKg({ weightKg: 3, unit: "kg" })).toBe(3);
    expect(lineKg({ weightKg: 2, unit: "paket", packageWeightGrams: 1500 })).toBe(3);
    expect(totalKg([{ weightKg: 2, unit: "kg" }, { weightKg: 1, unit: "paket", packageWeightGrams: 1500 }])).toBe(3.5);
  });

  it("avvisar ordrar som skulle passera områdets tak, prenumerationer stoppas inte", async () => {
    const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "haninge" } });
    const products = await prisma.product.findMany({ where: { unit: "kg", active: true }, orderBy: { sortOrder: "asc" } });
    const date = toISODate(
      upcomingDeliveryDates({ weekdays: JSON.parse(area.weekdaysJson), leadTimeDays: area.leadTimeDays }, 8)[7]
    );
    const base = (n: number) => ({
      items: [{ productId: products[0].id, weightKg: 4 }],
      areaSlug: "haninge",
      deliveryDate: date,
      companyName: "Kapacitetsbolaget AB",
      orgNumber: orgNumber(`${557100 + n}889`),
      contactName: "Kapa Citet",
      email: `kapacitet${n}@testbolaget.se`,
      phone: "070-111 22 33",
      deliveryAddress: "Taksgatan 1",
      deliveryPostalCode: "136 40",
      deliveryCity: "Haninge",
      deliveryInstruction: "",
      invoiceEmail: `kapacitet${n}@testbolaget.se`,
      reference: "",
      billingAddress: "",
    });
    await prisma.deliveryArea.update({ where: { id: area.id }, data: { maxKgPerDay: 6 } });
    try {
      const first = await createOrder(base(1), { skipEmails: true });
      expect(first.duplicate).toBe(false);
      await expect(createOrder(base(2), { skipEmails: true })).rejects.toMatchObject({ code: "DAY_FULL", field: "deliveryDate" });
      // Prenumerationsordrar räknas in men stoppas aldrig.
      const subscription = await prisma.subscription.create({
        data: {
          number: `PREN-TEST-${Date.now()}`,
          companyName: "Kapacitetsbolaget AB",
          orgNumber: orgNumber("557199889"),
          contactName: "Kapa Citet",
          email: "kapacitet-pren@testbolaget.se",
          deliveryAddress: "Taksgatan 1",
          deliveryPostalCode: "136 40",
          deliveryCity: "Haninge",
          deliveryAreaId: area.id,
          invoiceEmail: "kapacitet-pren@testbolaget.se",
          frequency: "WEEKLY",
          nextDeliveryDate: fromISODate(date),
        },
      });
      const sub = await createOrder(base(3), { skipEmails: true, subscription: { id: subscription.id, period: date } });
      expect(sub.order.id).toBeTruthy();
      // Fakturor ligger kvar med RESTRICT — avbryt i stället för att radera, så
      // att raderna inte räknas in i kapaciteten för nästa körning.
      await prisma.order.updateMany({ where: { id: { in: [first.order.id, sub.order.id] } }, data: { status: "CANCELLED" } });
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED" } });
    } finally {
      await prisma.deliveryArea.update({ where: { id: area.id }, data: { maxKgPerDay: 0 } });
    }
  });

  it("OrderError bär koden", () => {
    expect(new OrderError("x", "deliveryDate", "DAY_FULL").code).toBe("DAY_FULL");
  });
});

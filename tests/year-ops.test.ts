import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  addDays,
  changeDeadline,
  fromISODate,
  isoWeekday,
  isSwedishHoliday,
  isoWeekParts,
  stockholmTime,
  swedishHolidayName,
  toISODate,
  upcomingDeliveryDates,
} from "@/lib/dates";
import { createSubscription, generateDueSubscriptionOrders } from "@/lib/subscriptions/service";
import { createOrder } from "@/lib/orders/create-order";
import { issueCreditNote } from "@/lib/invoice/credit";
import { parseSnapshot } from "@/lib/invoice/snapshot";
import { agingKey } from "@/lib/invoice/aging";
import { isInvoiceOverdue } from "@/lib/status";
import { lockDeliveryDate } from "@/lib/warehouse/lock";
import { invoiceConfig } from "@/lib/config";
import { effectiveVatRateBp, FOOD_VAT_RATE_BP, foodVatNotice } from "@/lib/vat";
import { pollInclude, pollState } from "@/lib/polls/service";
import { orgNumber } from "./helpers";
import type { SubscriptionInput } from "@/lib/validation";

// Ett års drift från första möjliga torsdag: vecko-/varannan-/månadsprenumeration,
// daglig cron, låsning, faktura, helgdagar, årsskifte, moms, omröstning.

const HORIZON_DAYS = 370;
const TAG = "Årsdrift";

let productId = "";
let firstIso = "";
let weeklyNo = "";
let biweeklyNo = "";
let monthlyNo = "";
let start: Date;
let end: Date;
let reservedIso = "";

beforeAll(async () => {
  const products = await prisma.product.findMany({ where: { active: true, unit: "kg" }, orderBy: { sortOrder: "asc" } });
  productId = products[0]!.id;
  const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
  const weekdays = JSON.parse(area.weekdaysJson) as number[];
  firstIso = toISODate(upcomingDeliveryDates({ weekdays, leadTimeDays: area.leadTimeDays }, 1)[0]!);
  reservedIso = toISODate(upcomingDeliveryDates({ weekdays, leadTimeDays: area.leadTimeDays }, 10)[9]!);
  start = addDays(fromISODate(firstIso), -4);
  end = addDays(fromISODate(firstIso), HORIZON_DAYS);

  await prisma.subscription.updateMany({ where: { status: "ACTIVE" }, data: { status: "PAUSED" } });

  const base = (areaSlug: string, postal: string, city: string, n: number, extra: Partial<SubscriptionInput> = {}): SubscriptionInput => ({
    items: [{ productId, weightKg: 2 }],
    frequency: "WEEKLY",
    areaSlug,
    firstDeliveryDate: firstIso,
    companyName: `${TAG} ${n} AB`,
    orgNumber: orgNumber(`${558200 + n}001`),
    contactName: "Drift Test",
    email: `arsdrift${n}@testforetaget.se`,
    phone: "070-123 45 67",
    deliveryAddress: "Industrivägen 1",
    deliveryPostalCode: postal,
    deliveryCity: city,
    deliveryInstruction: "",
    invoiceEmail: `arsdrift-faktura${n}@testforetaget.se`,
    reference: `ÅR-${n}`,
    ...extra,
  });

  weeklyNo = (await createSubscription(base("tyreso", "135 48", "Tyresö", 1, { frequency: "WEEKLY" }))).subscription.number;
  biweeklyNo = (await createSubscription(base("nacka", "131 54", "Nacka", 2, { frequency: "BIWEEKLY" }))).subscription.number;
  monthlyNo = (await createSubscription(base("huddinge", "141 52", "Huddinge", 3, { frequency: "MONTHLY" }))).subscription.number;
}, 60_000);

describe("kalender ett år framåt", () => {
  it("inga torsdagshelger 2026–2027 blir leveransdagar, och julveckan hoppas över", () => {
    const cfg = { weekdays: [4], leadTimeDays: 2 };
    const holidays: string[] = [];
    for (let d = fromISODate("2026-09-17"); d.getTime() <= fromISODate("2027-09-16").getTime(); d = addDays(d, 1)) {
      if (isoWeekday(d) === 4 && isSwedishHoliday(d)) holidays.push(`${toISODate(d)} ${swedishHolidayName(d)}`);
    }
    expect(holidays).toEqual([
      "2026-12-24 julafton",
      "2026-12-31 nyårsafton",
      "2027-05-06 Kristi himmelsfärdsdag",
    ]);
    const aroundJul = upcomingDeliveryDates(cfg, 4, new Date("2026-12-14T08:00:00.000Z")).map(toISODate);
    expect(aroundJul).toEqual(["2026-12-17", "2027-01-07", "2027-01-14", "2027-01-21"]);
    const aroundKristi = upcomingDeliveryDates(cfg, 3, new Date("2027-04-26T08:00:00.000Z")).map(toISODate);
    expect(aroundKristi).toEqual(["2027-04-29", "2027-05-13", "2027-05-20"]);
  });

  it("ändringsdeadline hoppar över trettondagen (onsdag 2027-01-06)", () => {
    const deadline = changeDeadline(fromISODate("2027-01-07"), 2, 12);
    expect(toISODate(deadline)).toBe("2027-01-04"); // mån, inte ons (helgdag) eller tis
  });

  it("2026 har ISO-vecka 53 och Lucia infaller på en söndag (ingen leveranskonflikt)", () => {
    expect(isoWeekParts(fromISODate("2026-12-31"))).toEqual({ year: 2026, week: 53 });
    expect(isoWeekParts(fromISODate("2027-01-04"))).toEqual({ year: 2027, week: 1 });
    expect(isoWeekday(fromISODate("2026-12-13"))).toBe(7);
    expect(swedishHolidayName(fromISODate("2026-12-13"))).toBeNull();
  });

  it("livsmedelsmomsen är 6 % hela driftsåret och brådskande först i dec 2027", () => {
    expect(effectiveVatRateBp(FOOD_VAT_RATE_BP, "2026-12-17")).toBe(600);
    expect(effectiveVatRateBp(FOOD_VAT_RATE_BP, "2027-09-16")).toBe(600);
    expect(effectiveVatRateBp(FOOD_VAT_RATE_BP, "2028-01-07")).toBe(1200);
    expect(foodVatNotice("2027-09-12", 4)?.urgent).toBe(false);
    expect(foodVatNotice("2027-12-15", 4)?.urgent).toBe(true);
  });
});

describe("ett års drift i motorn", () => {
  it(
    "cron + låsning + faktura över 370 dagar: inga helgdagsleveranser, unika nummer, kadens överlever jul",
    async () => {
      const locked = new Set<string>();
      let doubleRunExtras = 0;

      for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
        const now = stockholmTime(d, 6);
        const run = await generateDueSubscriptionOrders({ now, horizonDays: 3, skipEmails: true });
        if (isoWeekday(d) === 1 && !isSwedishHoliday(d)) {
          const again = await generateDueSubscriptionOrders({ now, horizonDays: 3, skipEmails: true });
          doubleRunExtras += again.generated.length;
        }
        if (isoWeekday(d) === 4 && !isSwedishHoliday(d) && toISODate(d) !== reservedIso) {
          const iso = toISODate(d);
          const hasOurs = run.generated.some((g) => g.deliveryDate === iso) || (await prisma.order.count({
            where: { deliveryDate: d, companyName: { startsWith: TAG } },
          })) > 0;
          if (hasOurs) {
            const lock = await lockDeliveryDate(d, "cron", { sendEmail: false });
            expect(["LOCKED", "PICKING", "PACKED", "DELIVERED"]).toContain(lock.status);
            const again = await lockDeliveryDate(d, "cron", { sendEmail: false });
            expect(again.alreadyLocked).toBe(true);
            locked.add(iso);
          }
        }
        void run;
      }

      expect(doubleRunExtras).toBe(0);

      const orders = await prisma.order.findMany({
        where: { companyName: { startsWith: TAG }, status: { not: "CANCELLED" } },
        include: { invoice: true, items: true, subscription: { select: { number: true, frequency: true } } },
        orderBy: { deliveryDate: "asc" },
      });
      expect(orders.length).toBeGreaterThan(70);

      const nums = orders.map((o) => o.orderNumber);
      expect(new Set(nums).size).toBe(nums.length);
      const invNums = orders.map((o) => o.invoice!.invoiceNumber);
      expect(new Set(invNums).size).toBe(invNums.length);

      for (const o of orders) {
        expect(isSwedishHoliday(o.deliveryDate), toISODate(o.deliveryDate)).toBe(false);
        expect(isoWeekday(o.deliveryDate)).toBe(4);
        expect(o.invoice).not.toBeNull();
        expect(toISODate(o.invoice!.dueDate)).toBe(toISODate(addDays(o.deliveryDate, invoiceConfig.paymentTermsDays)));
        expect(o.vatOre).toBeGreaterThan(0);
        const snap = parseSnapshot(o.invoice!.snapshotJson);
        expect(snap.seller.iban).toMatch(/^LT71/);
        expect(snap.seller.vatNumber).toBe("SE559141704201");
        expect(snap.dueDate).toBe(toISODate(o.invoice!.dueDate));
        expect(snap.lines.every((l) => l.vatRateBp === FOOD_VAT_RATE_BP)).toBe(true);
        expect(o.items.every((i) => i.vatRateBp === FOOD_VAT_RATE_BP)).toBe(true);
      }

      const bySub = (n: string) => orders.filter((o) => o.subscription?.number === n);
      const weekly = bySub(weeklyNo);
      const biweekly = bySub(biweeklyNo);
      const monthly = bySub(monthlyNo);

      expect(weekly.length).toBeGreaterThanOrEqual(48);
      expect(weekly.length).toBeLessThanOrEqual(53);
      expect(biweekly.length).toBeGreaterThanOrEqual(24);
      expect(biweekly.length).toBeLessThanOrEqual(27);
      expect(monthly.length).toBeGreaterThanOrEqual(12);
      expect(monthly.length).toBeLessThanOrEqual(14);

      const gaps = (list: typeof weekly) =>
        list.slice(1).map((o, i) => (o.deliveryDate.getTime() - list[i]!.deliveryDate.getTime()) / 86400000);
      for (const g of gaps(weekly)) {
        expect(g % 7).toBe(0);
        expect(g).toBeGreaterThanOrEqual(7);
        expect(g).toBeLessThanOrEqual(21);
      }
      expect(gaps(weekly).some((g) => g >= 14)).toBe(true);

      const weeklyIsos = new Set(weekly.map((o) => toISODate(o.deliveryDate)));
      expect(weeklyIsos.has("2026-12-24")).toBe(false);
      expect(weeklyIsos.has("2026-12-31")).toBe(false);
      expect(weeklyIsos.has("2027-05-06")).toBe(false);
      if (firstIso <= "2026-12-17") {
        expect(weeklyIsos.has("2026-12-17")).toBe(true);
        expect(weeklyIsos.has("2027-01-07")).toBe(true);
        expect(weeklyIsos.has("2027-01-14")).toBe(true);
      }

      const periods = await prisma.order.groupBy({
        by: ["subscriptionId", "subscriptionPeriod"],
        where: { subscriptionId: { not: null }, companyName: { startsWith: TAG } },
      });
      expect(periods).toHaveLength(orders.filter((o) => o.subscriptionId).length);

      expect(locked.size).toBeGreaterThan(40);
    },
    180_000
  );

  it("engångsorder, delkreditering och åldrande efter årsskiftet", async () => {
    const { order, invoice } = await createOrder(
      {
        items: [{ productId, weightKg: 3 }],
        areaSlug: "tyreso",
        deliveryDate: reservedIso,
        companyName: `${TAG} Engång AB`,
        orgNumber: orgNumber("558299001"),
        contactName: "Engång Test",
        email: "arsdrift-engang@testforetaget.se",
        phone: "070-123 45 67",
        deliveryAddress: "Industrivägen 1",
        deliveryPostalCode: "135 48",
        deliveryCity: "Tyresö",
        deliveryInstruction: "",
        invoiceEmail: "arsdrift-engang-faktura@testforetaget.se",
        reference: "ENGANG",
        billingAddress: "",
      },
      { skipEmails: true }
    );
    expect(invoice.totalOre).toBe(order.totalOre);
    const credit = await issueCreditNote(invoice.id, "test", {
      lines: [{ lineIndex: 0, qty: 1 }],
      reason: "1 kg saknades vid leverans",
    });
    expect(credit).not.toBeNull();
    expect(credit!.totalOre).toBeLessThan(0);
    expect(credit!.kind).toBe("PARTIAL");

    const afterDue = addDays(invoice.dueDate, 1);
    expect(isInvoiceOverdue({ status: "UNPAID", dueDate: invoice.dueDate }, afterDue)).toBe(true);
    expect(agingKey(invoice.dueDate, addDays(invoice.dueDate, 40))).toBe("overdue");
    expect(agingKey(invoice.dueDate, addDays(fromISODate(toISODate(invoice.dueDate)), -10))).toBe("later");
  });

  it("Folkets kaka: Luciadagen stänger omröstningen utan att krocka med torsdagsleverans", async () => {
    const poll = await prisma.poll.findUnique({ where: { slug: "folkets-nasta-smakaka-1" }, include: pollInclude });
    expect(poll).not.toBeNull();
    expect(toISODate(poll!.endsAt)).toBe("2026-12-13");
    expect(pollState(poll!, fromISODate("2026-12-13"))).not.toBe("UPCOMING");
    expect(pollState(poll!, addDays(fromISODate("2026-12-13"), 1))).toBe("CLOSED");
  });
});

/**
 * Demo/preview (SQLite): en månads drift med 20 företagskunder.
 * Aldrig mot Neon-produktion.
 *
 * Tidslinje (idag = onsdag 9 sep 2026, cutoff kl 12 för morgondagens körning):
 *   levererade  30 jul – 3 sep
 *   bokade      10 sep (imorgon, öppen vecka)
 *   bokade      17 sep, 24 sep, 1 okt
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { invoiceConfig } from "../src/lib/config";
import { addDays, fromISODate, toISODate } from "../src/lib/dates";
import { calculateTotals } from "../src/lib/money";
import { nextNumber } from "../src/lib/numbering";
import { effectiveVatRateBp } from "../src/lib/vat";
import type { InvoiceSnapshot } from "../src/lib/invoice/snapshot";
import { issueCreditNoteInTx } from "../src/lib/invoice/credit";
import { lockDeliveryDate } from "../src/lib/warehouse/lock";
import { setPickStatus } from "../src/lib/warehouse/pick";
import { adjustInventory } from "../src/lib/warehouse/inventory";
import { ensureDeliveryWeek } from "../src/lib/warehouse/snapshot";
import { newManageToken } from "../src/lib/subscriptions/manage";

function demoOrgNumber(base9: string): string {
  const digits = base9.replace(/\D/g, "").slice(0, 9).padStart(9, "5");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  const full = digits + String(check);
  return `${full.slice(0, 6)}-${full.slice(6)}`;
}

type Freq = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
type Item = { slug: string; kg: number };

interface Customer {
  key: string;
  company: string;
  orgBase: string;
  contact: string;
  area: "tyreso" | "nacka" | "haninge" | "huddinge";
  address: string;
  postal: string;
  city: string;
  instruction?: string;
  reference?: string;
  freq?: Freq;
  items?: Item[];
  start?: string;
  pauseAfter?: string;
  pay: "prompt" | "none" | "slow";
  extras?: { date: string; items: Item[]; cancel?: boolean; creditKg?: number }[];
}

const CUSTOMERS: Customer[] = [
  { key: "granudden", company: "Granuddens Bygg AB", orgBase: "556701001", contact: "Greta Gran", area: "tyreso", address: "Granuddsvägen 12", postal: "135 40", city: "Tyresö", instruction: "Lämna i byggbodens kök.", freq: "WEEKLY", items: [{ slug: "kolasnittar", kg: 2 }], start: "2026-07-30", pay: "prompt" },
  { key: "breviken", company: "Brevikens Redovisning AB", orgBase: "556701002", contact: "Bo Brevik", area: "tyreso", address: "Breviksvägen 8", postal: "135 43", city: "Tyresö", freq: "BIWEEKLY", items: [{ slug: "kolasnittar", kg: 1 }, { slug: "mandelkubb", kg: 1 }], start: "2026-07-30", pay: "slow" },
  { key: "strandangen", company: "Strandängens Fastigheter AB", orgBase: "556701003", contact: "Stina Strand", area: "tyreso", address: "Strandängsvägen 4", postal: "135 48", city: "Tyresö", instruction: "Receptionen, märk Strandängen fika.", freq: "WEEKLY", items: [{ slug: "kolasnittar", kg: 1 }, { slug: "chokladsnittar", kg: 1 }], start: "2026-07-30", pay: "prompt" },
  { key: "bollmora", company: "Bollmora Kontorshotell AB", orgBase: "556701004", contact: "Bella Bollmora", area: "tyreso", address: "Bollmoravägen 20", postal: "135 41", city: "Tyresö", freq: "MONTHLY", items: [{ slug: "prova-pa-paket", kg: 1 }], start: "2026-08-06", pay: "prompt" },
  { key: "tyresoel", company: "Tyresö El & Automation AB", orgBase: "556701005", contact: "Ture Elg", area: "tyreso", address: "Industrivägen 7", postal: "135 49", city: "Tyresö", pay: "prompt", extras: [
    { date: "2026-08-20", items: [{ slug: "kolasnittar", kg: 2 }] },
    { date: "2026-09-10", items: [{ slug: "mandelkubb", kg: 2 }, { slug: "chokladsnittar", kg: 1 }] },
    { date: "2026-09-24", items: [{ slug: "kolasnittar", kg: 3 }] },
  ] },
  { key: "sickla", company: "Sickla Verkstad AB", orgBase: "556701006", contact: "Sven Sickla", area: "nacka", address: "Uddvägen 7", postal: "131 54", city: "Nacka", instruction: "Verkstadskontoret, ring vid grind.", freq: "WEEKLY", items: [{ slug: "kolasnittar", kg: 3 }], start: "2026-07-30", pay: "none" },
  { key: "nackahamn", company: "Nacka Hamn Juridik AB", orgBase: "556701007", contact: "Nora Nacka", area: "nacka", address: "Augustendalsvägen 19", postal: "131 52", city: "Nacka", reference: "Fika våning 4", freq: "BIWEEKLY", items: [{ slug: "chokladsnittar", kg: 1 }], start: "2026-07-30", pay: "prompt" },
  { key: "alta", company: "Älta Montage AB", orgBase: "556701008", contact: "Åke Älta", area: "nacka", address: "Ältavägen 101", postal: "138 32", city: "Nacka", pay: "prompt", extras: [
    { date: "2026-08-06", items: [{ slug: "mandelkubb", kg: 2 }] },
    { date: "2026-09-10", items: [{ slug: "kolasnittar", kg: 2 }] },
  ] },
  { key: "fisksatra", company: "Fisksätra Service AB", orgBase: "556701009", contact: "Fia Fisk", area: "nacka", address: "Fisksätravägen 22", postal: "133 41", city: "Nacka", freq: "WEEKLY", items: [{ slug: "mandelkubb", kg: 1 }], start: "2026-07-30", pauseAfter: "2026-09-03", pay: "prompt" },
  { key: "saltsjo", company: "Saltsjöbadens Arkitekter AB", orgBase: "556701010", contact: "Saga Salt", area: "nacka", address: "Hotellvägen 1", postal: "133 70", city: "Nacka", freq: "MONTHLY", items: [{ slug: "kolasnittar", kg: 1 }, { slug: "mandelkubb", kg: 1 }], start: "2026-08-06", pay: "prompt" },
  { key: "handen", company: "Handens Industri AB", orgBase: "556701011", contact: "Hanna Handen", area: "haninge", address: "Rudsjöterrassen 3", postal: "136 40", city: "Haninge", instruction: "Lastkaj B, märk fika.", freq: "WEEKLY", items: [{ slug: "kolasnittar", kg: 2 }, { slug: "mandelkubb", kg: 1 }, { slug: "chokladsnittar", kg: 1 }], start: "2026-07-30", pay: "prompt" },
  { key: "vega", company: "Vega Entreprenad AB", orgBase: "556701012", contact: "Viktor Vega", area: "haninge", address: "Vegavägen 14", postal: "136 49", city: "Haninge", freq: "BIWEEKLY", items: [{ slug: "kolasnittar", kg: 2 }], start: "2026-07-30", pay: "prompt" },
  { key: "jordbro", company: "Jordbro Logistik AB", orgBase: "556701013", contact: "Jonas Jordbro", area: "haninge", address: "Lagervägen 5", postal: "136 50", city: "Haninge", pay: "prompt", extras: [
    { date: "2026-08-27", items: [{ slug: "kolasnittar", kg: 3 }, { slug: "mandelkubb", kg: 2 }] },
    { date: "2026-09-17", items: [{ slug: "prova-pa-paket", kg: 2 }] },
  ] },
  { key: "brandbergen", company: "Brandbergens Förvaltning AB", orgBase: "556701014", contact: "Berit Brand", area: "haninge", address: "Brandbergsvägen 30", postal: "136 73", city: "Haninge", freq: "WEEKLY", items: [{ slug: "kolasnittar", kg: 2 }], start: "2026-07-30", pay: "prompt" },
  { key: "dalaro", company: "Dalarö Sjöservice AB", orgBase: "556701015", contact: "Doris Dalarö", area: "haninge", address: "Dalarövägen 2", postal: "137 70", city: "Haninge", freq: "MONTHLY", items: [{ slug: "mandelkubb", kg: 2 }], start: "2026-07-30", pay: "prompt", extras: [
    { date: "2026-08-13", items: [{ slug: "mandelkubb", kg: 2 }], creditKg: 1 },
  ] },
  { key: "flemingsberg", company: "Flemingsbergs Kontor AB", orgBase: "556701016", contact: "Filip Flem", area: "huddinge", address: "Viewegatan 2", postal: "141 52", city: "Huddinge", instruction: "Entrén mot pendeln.", freq: "WEEKLY", items: [{ slug: "kolasnittar", kg: 2 }], start: "2026-07-30", pay: "prompt" },
  { key: "skogas", company: "Skogås VVS AB", orgBase: "556701017", contact: "Sanna Skogås", area: "huddinge", address: "Storvretsvägen 18", postal: "142 30", city: "Huddinge", pay: "prompt", extras: [
    { date: "2026-08-20", items: [{ slug: "chokladsnittar", kg: 2 }], cancel: true },
    { date: "2026-09-10", items: [{ slug: "kolasnittar", kg: 2 }] },
  ] },
  { key: "hudrev", company: "Huddinge Revision AB", orgBase: "556701018", contact: "Henrik Huddinge", area: "huddinge", address: "Kommunalvägen 28", postal: "141 04", city: "Huddinge", reference: "Att. ekonomi", freq: "BIWEEKLY", items: [{ slug: "kolasnittar", kg: 1 }, { slug: "chokladsnittar", kg: 1 }], start: "2026-07-30", pay: "prompt" },
  { key: "kurva", company: "Kungens Kurva Handel AB", orgBase: "556701019", contact: "Karin Kurva", area: "huddinge", address: "Ekgårdsvägen 2", postal: "141 75", city: "Huddinge", freq: "WEEKLY", items: [{ slug: "kolasnittar", kg: 2 }, { slug: "chokladsnittar", kg: 1 }], start: "2026-07-30", pay: "prompt" },
  { key: "segeltorp", company: "Segeltorps Maskin AB", orgBase: "556701020", contact: "Selma Segel", area: "huddinge", address: "Häradsvägen 55", postal: "141 63", city: "Huddinge", freq: "MONTHLY", items: [{ slug: "kolasnittar", kg: 2 }], start: "2026-08-06", pay: "prompt", extras: [
    { date: "2026-09-10", items: [{ slug: "mandelkubb", kg: 1 }, { slug: "prova-pa-paket", kg: 1 }] },
  ] },
];

const PAST = ["2026-07-30", "2026-08-06", "2026-08-13", "2026-08-20", "2026-08-27", "2026-09-03"];
const CURRENT = "2026-09-10";
const HORIZON = "2026-10-01";
const ACTOR = "seed";

function gapDays(freq: Freq): number {
  return freq === "WEEKLY" ? 7 : freq === "BIWEEKLY" ? 14 : 28;
}

function cadence(start: string, freq: Freq, until: string, pauseAfter?: string): string[] {
  const last = pauseAfter && pauseAfter < until ? pauseAfter : until;
  const out: string[] = [];
  let d = fromISODate(start);
  const end = fromISODate(last);
  while (d.getTime() <= end.getTime()) {
    out.push(toISODate(d));
    d = addDays(d, gapDays(freq));
  }
  return out;
}

function emailFor(c: Customer): string {
  return `${c.contact.split(" ")[0].toLowerCase()}@${c.key}.test`;
}

export async function seedMonth(): Promise<void> {
  if (!(process.env.DATABASE_URL ?? "").startsWith("file:")) {
    console.log("seed-month: hoppar över (inte SQLite-demo).");
    return;
  }

  await prisma.orderEvent.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscriptionItem.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.deliveryWeek.deleteMany();

  for (const [name, value] of [
    ["order", 100000],
    ["invoice", 10000],
    ["subscription", 1000],
  ] as const) {
    await prisma.counter.upsert({ where: { name }, create: { name, value }, update: { value } });
  }

  const products = await prisma.product.findMany();
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const areas = await prisma.deliveryArea.findMany();
  const byArea = new Map(areas.map((a) => [a.slug, a]));

  for (const a of areas) {
    await prisma.deliveryArea.update({ where: { id: a.id }, data: { maxKgPerDay: 50 } });
  }

  const startStock: Record<string, { physicalGrams: number; minGrams: number }> = {
    mandelkubb: { physicalGrams: 18000, minGrams: 4000 },
    kolasnittar: { physicalGrams: 28000, minGrams: 5000 },
    chokladsnittar: { physicalGrams: 14000, minGrams: 4000 },
    "prova-pa-paket": { physicalGrams: 9000, minGrams: 3000 },
  };
  for (const p of products) {
    const stock = startStock[p.slug] ?? { physicalGrams: 0, minGrams: 0 };
    const inv = await prisma.inventory.upsert({
      where: { productId: p.id },
      create: { productId: p.id, ...stock },
      update: { physicalGrams: stock.physicalGrams, minGrams: stock.minGrams },
    });
    await prisma.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        productId: p.id,
        kind: "ADJUSTMENT",
        gramsDelta: stock.physicalGrams,
        reason: "Ingående lagersaldo vid systemstart",
        actor: "system",
        beforeGrams: 0,
        afterGrams: stock.physicalGrams,
      },
    });
  }

  type SubRow = { id: string; number: string };
  const subs = new Map<string, SubRow>();

  for (const c of CUSTOMERS) {
    if (!c.freq || !c.items || !c.start) continue;
    const area = byArea.get(c.area)!;
    const number = await prisma.$transaction((tx) => nextNumber(tx, "subscription"));
    const dates = cadence(c.start, c.freq, HORIZON, c.pauseAfter);
    const lastPlaced = dates[dates.length - 1];
    const next = lastPlaced ? toISODate(addDays(fromISODate(lastPlaced), gapDays(c.freq))) : c.start;
    const row = await prisma.subscription.create({
      data: {
        number,
        idempotencyKey: `seed-month-sub-${c.key}`,
        manageToken: newManageToken(),
        companyName: c.company,
        orgNumber: demoOrgNumber(c.orgBase),
        contactName: c.contact,
        email: emailFor(c),
        phone: `08-55${c.orgBase.slice(-2)} 10 ${c.orgBase.slice(-2)}`,
        deliveryAddress: c.address,
        deliveryPostalCode: c.postal,
        deliveryCity: c.city,
        deliveryInstruction: c.instruction ?? "",
        deliveryAreaId: area.id,
        invoiceEmail: `faktura@${c.key}.test`,
        reference: c.reference ?? "",
        frequency: c.freq,
        nextDeliveryDate: fromISODate(next),
        status: c.pauseAfter ? "PAUSED" : "ACTIVE",
        createdAt: addDays(fromISODate(c.start), -10),
        items: {
          create: c.items.map((i) => ({ productId: bySlug.get(i.slug)!.id, weightKg: i.kg })),
        },
      },
    });
    subs.set(c.key, { id: row.id, number: row.number });
  }

  async function placeOrder(opts: {
    c: Customer;
    date: string;
    items: Item[];
    subscription?: SubRow;
    createdAt: Date;
  }) {
    const area = byArea.get(opts.c.area)!;
    const deliveryDate = fromISODate(opts.date);
    const lines = opts.items.map((item) => {
      const product = bySlug.get(item.slug);
      if (!product) throw new Error(`Okänd produkt ${item.slug}`);
      return {
        productId: product.id,
        productName: product.name,
        weightKg: item.kg,
        unit: product.unit,
        packageWeightGrams: product.packageWeightGrams,
        unitPricePerKgOre: product.pricePerKgOre,
        vatRateBp: effectiveVatRateBp(product.vatRateBp, opts.date),
        lineTotalOre: item.kg * product.pricePerKgOre,
      };
    });
    const totals = calculateTotals(lines.map((l) => ({ netOre: l.lineTotalOre, vatRateBp: l.vatRateBp })));
    const invoiceDate = addDays(deliveryDate, -2);
    const dueDate = addDays(deliveryDate, invoiceConfig.paymentTermsDays);
    const downloadToken = randomBytes(24).toString("hex");

    return prisma.$transaction(async (tx) => {
      const orderNumber = await nextNumber(tx, "order");
      const invoiceNumber = await nextNumber(tx, "invoice");
      const order = await tx.order.create({
        data: {
          orderNumber,
          idempotencyKey: `seed-month-${opts.c.key}-${opts.date}-${opts.subscription ? "sub" : "one"}`,
          companyName: opts.c.company,
          orgNumber: demoOrgNumber(opts.c.orgBase),
          contactName: opts.c.contact,
          email: emailFor(opts.c),
          phone: `08-55${opts.c.orgBase.slice(-2)} 10 ${opts.c.orgBase.slice(-2)}`,
          deliveryAddress: opts.c.address,
          deliveryPostalCode: opts.c.postal,
          deliveryCity: opts.c.city,
          deliveryInstruction: opts.c.instruction ?? "",
          deliveryDate,
          deliveryAreaId: area.id,
          invoiceEmail: `faktura@${opts.c.key}.test`,
          reference: opts.c.reference ?? "",
          subtotalOre: totals.subtotalOre,
          vatOre: totals.vatOre,
          totalOre: totals.totalOre,
          subscriptionId: opts.subscription?.id,
          subscriptionPeriod: opts.subscription ? opts.date : null,
          status: PAST.includes(opts.date) || Boolean(opts.subscription) || opts.date !== CURRENT ? "CONFIRMED" : "NEW",
          createdAt: opts.createdAt,
          items: { create: lines },
        },
      });
      const snapshot: InvoiceSnapshot = {
        seller: {
          companyName: invoiceConfig.companyName,
          orgNumber: invoiceConfig.orgNumber,
          address: invoiceConfig.address,
          postalCode: invoiceConfig.postalCode,
          city: invoiceConfig.city,
          email: invoiceConfig.email,
          phone: invoiceConfig.phone,
          bankgiro: invoiceConfig.bankgiro,
          vatNumber: invoiceConfig.vatNumber,
          fSkatt: invoiceConfig.fSkatt,
        },
        buyer: {
          companyName: opts.c.company,
          orgNumber: demoOrgNumber(opts.c.orgBase),
          contactName: opts.c.contact,
          invoiceEmail: `faktura@${opts.c.key}.test`,
          billingAddress: `${opts.c.address}, ${opts.c.postal} ${opts.c.city}`,
          reference: opts.c.reference ?? "",
        },
        orderNumber,
        deliveryDate: opts.date,
        deliveryAddress: `${opts.c.address}, ${opts.c.postal} ${opts.c.city}`,
        subscriptionNumber: opts.subscription?.number,
        lines: lines.map(({ productId: _p, packageWeightGrams: _g, ...rest }) => rest),
        subtotalOre: totals.subtotalOre,
        vatOre: totals.vatOre,
        totalOre: totals.totalOre,
        currency: "SEK",
        invoiceDate: toISODate(invoiceDate),
        dueDate: toISODate(dueDate),
        paymentTermsDays: invoiceConfig.paymentTermsDays,
      };
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          invoiceDate,
          dueDate,
          snapshotJson: JSON.stringify(snapshot),
          subtotalOre: totals.subtotalOre,
          vatOre: totals.vatOre,
          totalOre: totals.totalOre,
          downloadToken,
          createdAt: opts.createdAt,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "CREATED",
          message: opts.subscription
            ? `Order skapad från prenumeration ${opts.subscription.number}. Faktura ${invoiceNumber} utfärdad.`
            : `Order mottagen. Faktura ${invoiceNumber} utfärdad.`,
          createdAt: opts.createdAt,
        },
      });
      return { order, invoice };
    });
  }

  const placed: { orderId: string; invoiceId: string; date: string; key: string; pay: Customer["pay"]; cancel?: boolean; creditKg?: number }[] = [];

  for (const c of CUSTOMERS) {
    if (c.freq && c.items && c.start) {
      const dates = cadence(c.start, c.freq, HORIZON, c.pauseAfter);
      for (const date of dates) {
        const createdAt = addDays(fromISODate(date), -2);
        const { order, invoice } = await placeOrder({ c, date, items: c.items, subscription: subs.get(c.key), createdAt });
        placed.push({ orderId: order.id, invoiceId: invoice.id, date, key: c.key, pay: c.pay });
      }
    }
    for (const extra of c.extras ?? []) {
      const createdAt = addDays(fromISODate(extra.date), extra.cancel ? -5 : -2);
      const { order, invoice } = await placeOrder({ c, date: extra.date, items: extra.items, createdAt });
      placed.push({
        orderId: order.id,
        invoiceId: invoice.id,
        date: extra.date,
        key: c.key,
        pay: c.pay,
        cancel: extra.cancel,
        creditKg: extra.creditKg,
      });
    }
  }

  for (const row of placed.filter((p) => p.cancel)) {
    await prisma.$transaction(async (tx) => {
      await issueCreditNoteInTx(tx, row.invoiceId, ACTOR, { reason: "Avbokad av kunden före leverans" });
      await tx.order.update({
        where: { id: row.orderId },
        data: { status: "CANCELLED" },
      });
    });
  }
  for (const row of placed.filter((p) => p.creditKg && !p.cancel)) {
    await prisma.$transaction(async (tx) => {
      await issueCreditNoteInTx(tx, row.invoiceId, ACTOR, {
        lines: [{ lineIndex: 0, qty: row.creditKg! }],
        reason: "En kilo fattades vid leveransen",
      });
    });
  }

  const incoming: Record<string, number> = {
    kolasnittar: 20000,
    mandelkubb: 8000,
    chokladsnittar: 6000,
    "prova-pa-paket": 3000,
  };

  for (const iso of PAST) {
    const monday = addDays(fromISODate(iso), -3);
    for (const p of products) {
      const grams = incoming[p.slug] ?? 0;
      if (grams <= 0) continue;
      await adjustInventory({
        productId: p.id,
        gramsDelta: grams,
        kind: "INCOMING",
        reason: `Inkommen produktion inför ${iso}`,
        actor: ACTOR,
      });
      await prisma.inventoryMovement.updateMany({
        where: { productId: p.id, reason: `Inkommen produktion inför ${iso}` },
        data: { createdAt: monday },
      });
    }

    const lock = await lockDeliveryDate(fromISODate(iso), ACTOR, { sendEmail: false });
    if (lock.status !== "LOCKED" && !lock.alreadyLocked) {
      console.warn(`seed-month: kunde inte låsa ${iso}: ${lock.status} ${lock.error ?? ""}`);
    }

    const dayOrders = placed.filter((p) => p.date === iso && !p.cancel);
    for (const o of dayOrders) {
      await setPickStatus(o.orderId, "PICKED", ACTOR);
      await setPickStatus(o.orderId, "LOADED", ACTOR);
      await setPickStatus(o.orderId, "DELIVERED", ACTOR);
      await prisma.order.update({
        where: { id: o.orderId },
        data: { deliveredAt: addDays(fromISODate(iso), 0) },
      });
    }
  }

  // Imorgon och framåt: produktion så att frysen inte är tom, men mandelkubb
  // får ett synligt underskott mot bokad volym.
  for (const p of products) {
    const grams = p.slug === "mandelkubb" ? 4000 : p.slug === "kolasnittar" ? 12000 : p.slug === "chokladsnittar" ? 5000 : 3000;
    await adjustInventory({
      productId: p.id,
      gramsDelta: grams,
      kind: "INCOMING",
      reason: "Inkommen produktion inför kommande körning",
      actor: ACTOR,
    });
  }

  const stockAfterIncoming: Record<string, number> = {
    kolasnittar: 20000,
    mandelkubb: 3500,
    chokladsnittar: 7000,
    "prova-pa-paket": 4500,
  };
  for (const p of products) {
    const want = stockAfterIncoming[p.slug];
    if (want == null) continue;
    const inv = await prisma.inventory.findUnique({ where: { productId: p.id } });
    const delta = want - (inv?.physicalGrams ?? 0);
    if (delta === 0) continue;
    await adjustInventory({
      productId: p.id,
      gramsDelta: delta,
      kind: "ADJUSTMENT",
      reason: "Inventering efter inkommen produktion",
      actor: ACTOR,
    });
  }

  const openDates = [...new Set(placed.filter((p) => !p.cancel && !PAST.includes(p.date)).map((p) => p.date))].sort();
  for (const iso of openDates) {
    await ensureDeliveryWeek(fromISODate(iso));
  }

  for (const row of placed) {
    if (row.cancel) continue;
    if (!PAST.includes(row.date)) continue;
    const delivery = fromISODate(row.date);
    if (row.pay === "none") continue;
    if (row.pay === "slow" && row.date > "2026-08-06") continue;
    if (row.pay === "prompt" && row.date > "2026-08-27") continue;
    const paidAt = addDays(delivery, 12);
    await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.updateMany({
        where: { id: row.invoiceId, status: "UNPAID" },
        data: { status: "PAID", paidAt },
      });
      if (inv.count !== 1) return;
      await tx.order.update({ where: { id: row.orderId }, data: { paymentStatus: "PAID" } });
      await tx.orderEvent.create({
        data: { orderId: row.orderId, type: "PAID", message: "Inbetalning registrerad", actor: ACTOR, createdAt: paidAt },
      });
    });
  }

  const orders = await prisma.order.count();
  const subsN = await prisma.subscription.count();
  const unpaid = await prisma.invoice.count({ where: { status: "UNPAID" } });
  const paid = await prisma.invoice.count({ where: { status: "PAID" } });
  console.log(`Månadssimulation: ${CUSTOMERS.length} kunder, ${subsN} prenumerationer, ${orders} ordrar, ${paid} betalda / ${unpaid} obetalda fakturor.`);
}

if (process.argv[1]?.includes("seed-month")) {
  seedMonth()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

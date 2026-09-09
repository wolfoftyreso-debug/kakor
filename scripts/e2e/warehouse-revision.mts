import { prisma } from "../../src/lib/db";
import { createOrder } from "../../src/lib/orders/create-order";
import { createSubscription } from "../../src/lib/subscriptions/service";
import { generateDueSubscriptionOrders } from "../../src/lib/subscriptions/service";
import { lockDeliveryDate } from "../../src/lib/warehouse/lock";
import { setPickStatus } from "../../src/lib/warehouse/pick";
import { loadStock, reservedGramsByProduct, productionNeedGrams } from "../../src/lib/warehouse/inventory";
import { parseSnapshot } from "../../src/lib/warehouse/snapshot";
import { renderAllOpsPdfs } from "../../src/lib/warehouse/pdf";
import { fromISODate, toISODate, upcomingDeliveryDates } from "../../src/lib/dates";
import { isPastCutoff, leadTimeAllowingNextDelivery } from "../../src/lib/warehouse/cutoff";
import { getOpsSettings } from "../../src/lib/warehouse/settings";
import { getAreasWithDates } from "../../src/lib/products";
import type { CheckoutInput } from "../../src/lib/validation";

const results: [string, string][] = [];
const check = (name: string, ok: boolean, extra = "") => {
  results.push([ok ? "PASS" : "FAIL", name]);
  console.log((ok ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : ""));
};

async function reopenIfBeforeCutoff(date: Date, reason: string) {
  const settings = await getOpsSettings();
  if (isPastCutoff(date, settings)) return false;
  const res = await prisma.deliveryWeek.updateMany({
    where: { deliveryDate: date, status: { not: "OPEN" } },
    data: {
      status: "OPEN",
      snapshotJson: "",
      lockedAt: null,
      lockedBy: "",
      opsEmailSentAt: null,
      lastError: reason,
    },
  });
  return res.count > 0;
}

function orgNr(base9: string) {
  const d = base9.replace(/\D/g, "").slice(0, 9).padStart(9, "5");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let x = +d[i];
    if (i % 2 === 0) {
      x *= 2;
      if (x > 9) x -= 9;
    }
    sum += x;
  }
  return d + ((10 - (sum % 10)) % 10);
}

const hanging = await prisma.deliveryWeek.findMany();
for (const w of hanging) {
  await reopenIfBeforeCutoff(w.deliveryDate, "Öppnad före revisionstest – cutoff har inte infallit");
}
await prisma.inventory.updateMany({ where: { physicalGrams: { lt: 0 } }, data: { physicalGrams: 0 } });

const products = await prisma.product.findMany({ where: { active: true } });
const bySlug = (s: string) => products.find((p) => p.slug === s)!;
const area = await prisma.deliveryArea.findUniqueOrThrow({ where: { slug: "tyreso" } });
const ops = await getOpsSettings();
const weekdays: number[] = JSON.parse(area.weekdaysJson);
const effectiveLead = leadTimeAllowingNextDelivery(area.leadTimeDays, weekdays, ops);
const dates = upcomingDeliveryDates({ weekdays, leadTimeDays: effectiveLead, blockedDates: [] }, 4);
const thursday = dates[0];
if (!thursday) {
  console.error("Ingen leveransdag");
  process.exit(1);
}
const iso = toISODate(thursday);
console.log(`Nästa leveransdag enligt cutoff-medveten framförhållning: ${iso} (lead ${area.leadTimeDays} → ${effectiveLead})`);

const areas = await getAreasWithDates(4);
const tyreso = areas.find((a) => a.slug === "tyreso");
check("kassan erbjuder nästa torsdag före cutoff", !!tyreso?.upcomingDates.includes(iso), tyreso?.upcomingDates.join(",") ?? "");
check("kassan får konfigurerad framförhållning (inte fryst effektiv)", tyreso?.leadTimeDays === area.leadTimeDays, String(tyreso?.leadTimeDays));

const run = Date.now() % 100000;
const base = (n: number, name: string, email: string): Omit<CheckoutInput, "items" | "deliveryDate"> => ({
  areaSlug: "tyreso",
  companyName: name,
  orgNumber: orgNr(`${556700 + n}${run % 100}`),
  contactName: "Revision Test",
  email,
  phone: "070-123 45 67",
  deliveryAddress: `Revisionsgatan ${n}`,
  deliveryPostalCode: "135 48",
  deliveryCity: "Tyresö",
  deliveryInstruction: "",
  invoiceEmail: email,
  reference: "",
  billingAddress: "",
});

await prisma.inventory.upsert({
  where: { productId: bySlug("kolasnittar").id },
  create: { productId: bySlug("kolasnittar").id, physicalGrams: 10000, minGrams: 5000 },
  update: { physicalGrams: 10000 },
});
await prisma.inventory.upsert({
  where: { productId: bySlug("mandelkubb").id },
  create: { productId: bySlug("mandelkubb").id, physicalGrams: 2000, minGrams: 4000 },
  update: { physicalGrams: 2000 },
});
await prisma.inventory.upsert({
  where: { productId: bySlug("chokladsnittar").id },
  create: { productId: bySlug("chokladsnittar").id, physicalGrams: 4000, minGrams: 4000 },
  update: { physicalGrams: 4000 },
});

const sub = await createSubscription({
  ...base(1, "Kund A Revision AB", `a-${run}@rev.test`),
  firstDeliveryDate: iso,
  frequency: "WEEKLY",
  items: [{ productId: bySlug("kolasnittar").id, weightKg: 2 }],
  idempotencyKey: `rev-sub-a-${run}`,
});
check("kund A prenumeration skapad", !!sub.subscription.number, sub.subscription.number);

const gen = await generateDueSubscriptionOrders({ horizonDays: 4, skipEmails: true });
const aOrder = gen.generated.find((g) => g.subscriptionNumber === sub.subscription.number);
check("kund A materialiseras till leveransdagen", !!aOrder && aOrder.deliveryDate === iso, aOrder?.orderNumber ?? gen.skipped.map((s) => s.reason).join("; "));

const replay = await createSubscription({
  ...base(1, "Kund A Revision AB", `a-${run}@rev.test`),
  firstDeliveryDate: iso,
  frequency: "WEEKLY",
  items: [{ productId: bySlug("kolasnittar").id, weightKg: 2 }],
  idempotencyKey: `rev-sub-a-${run}`,
});
check("samma nyckel efter materialisering är retry inte ny prenumeration", replay.duplicate && replay.subscription.id === sub.subscription.id, replay.subscription.number);

const b = await createOrder(
  {
    ...base(2, "Kund B Revision AB", `b-${run}@rev.test`),
    deliveryDate: iso,
    items: [{ productId: bySlug("mandelkubb").id, weightKg: 3 }],
    idempotencyKey: `rev-ord-b-${run}`,
  },
  { skipEmails: true }
);
check("kund B 3 kg mandelkubb", b.order.orderNumber.startsWith("SB-"), b.order.orderNumber);

const c = await createOrder(
  {
    ...base(3, "Kund C Revision AB", `c-${run}@rev.test`),
    deliveryDate: iso,
    items: [{ productId: bySlug("chokladsnittar").id, weightKg: 1 }],
    idempotencyKey: `rev-ord-c-${run}`,
  },
  { skipEmails: true }
);
check("kund C 1 kg chokladsnittar", c.order.orderNumber.startsWith("SB-"), c.order.orderNumber);

const reserved = await reservedGramsByProduct();
check("kolasnittar reserverat 2 kg", (reserved.get(bySlug("kolasnittar").id) ?? 0) >= 2000, String(reserved.get(bySlug("kolasnittar").id)));
check("mandelkubb reserverat 3 kg", (reserved.get(bySlug("mandelkubb").id) ?? 0) >= 3000, String(reserved.get(bySlug("mandelkubb").id)));
check("chokladsnittar reserverat 1 kg", (reserved.get(bySlug("chokladsnittar").id) ?? 0) >= 1000, String(reserved.get(bySlug("chokladsnittar").id)));

const stock = await loadStock();
const man = stock.find((s) => s.slug === "mandelkubb")!;
check(
  "produktionsunderskott mandelkubb (3 kg beställt, 2 kg fysiskt)",
  productionNeedGrams(3000, man.physicalGrams) > 0 || man.availableGrams < 0,
  `fysiskt ${man.physicalGrams} reserverat ${man.reservedGrams} disponibelt ${man.availableGrams}`
);

const lock = await lockDeliveryDate(thursday, "revision@test.se", { sendEmail: true });
check("leveransdagen låses", lock.status === "LOCKED" || lock.alreadyLocked, `${lock.status} emailed=${lock.emailed} err=${lock.error ?? ""}`);

const week = await prisma.deliveryWeek.findUniqueOrThrow({ where: { deliveryDate: thursday } });
const snap = parseSnapshot(week.snapshotJson);
check("immutable snapshot finns", !!snap && snap.version === 1, `orders=${snap?.orderCount}`);
check(
  "A, B och C finns i snapshoten",
  !!snap &&
    snap.stops.some((s) => s.companyName.includes("Kund A")) &&
    snap.stops.some((s) => s.companyName.includes("Kund B")) &&
    snap.stops.some((s) => s.companyName.includes("Kund C")),
  snap?.stops.map((s) => s.companyName).join(" | ") ?? ""
);

if (snap) {
  const pdfs = await renderAllOpsPdfs(snap);
  check("leveranslista PDF", pdfs.lista.length > 500, String(pdfs.lista.length));
  check("plocklista PDF", pdfs.plock.length > 500, String(pdfs.plock.length));
  check("leveranssedlar PDF", pdfs.sedlar.length > 500, String(pdfs.sedlar.length));
}

const bId = b.order.id;
await setPickStatus(bId, "PICKED", "revision@test.se");
const afterPick = await prisma.inventory.findUniqueOrThrow({ where: { productId: bySlug("mandelkubb").id } });
check("plock minskar fysiskt lager 3 kg", afterPick.physicalGrams === man.physicalGrams - 3000, String(afterPick.physicalGrams));
await setPickStatus(bId, "LOADED", "revision@test.se");
await setPickStatus(bId, "DELIVERED", "revision@test.se");
const delivered = await prisma.order.findUniqueOrThrow({ where: { id: bId } });
check("plockkedja Picked → Lastad → Levererad", delivered.pickStatus === "DELIVERED" && delivered.deliveryStatus === "DELIVERED", delivered.pickStatus);

const historic = await prisma.deliveryWeek.findMany({ where: { status: { not: "OPEN" } } });
check("veckan finns i historiken", historic.some((w) => toISODate(w.deliveryDate) === iso), String(historic.length));

// Preview-DB: lämna inte kassan stängd före riktig cutoff.
const restored = await reopenIfBeforeCutoff(thursday, "Öppnad efter revisionstest – cutoff har inte infallit");
check("veckan öppnas igen före cutoff så kassan fungerar", restored || isPastCutoff(thursday, ops), restored ? "öppnad" : "cutoff passerad");
if (afterPick.physicalGrams < 0) {
  await prisma.inventory.update({ where: { productId: bySlug("mandelkubb").id }, data: { physicalGrams: 0 } });
}

const failed = results.filter((r) => r[0] === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
await prisma.$disconnect();

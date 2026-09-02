import { z } from "zod";
import { SUBSCRIPTION_FREQUENCY } from "@/lib/status";
import { fromISODate, toISODate } from "@/lib/dates";

// Kalenderriktigt datum: "2026-13-45" (Invalid Date → RangeError → 500) och
// "2026-02-30" (V8 tolkar som 2 mars → ordern hamnar på ett annat datum än
// kunden skickade) avvisas båda med ett vanligt fältfel.
export const isoDateSchema = (message: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((s) => {
      const d = fromISODate(s);
      return !Number.isNaN(d.getTime()) && toISODate(d) === s;
    }, "Ogiltigt datum");

// Server-side validering — frontendvalidering är UX, inte säkerhet.

// Enradsfält: radbrytningar/tabbar/kontrolltecken kollapsas till mellanslag
// INNAN längdkontrollen — annars bryter "Bolag\n".repeat(20) faktura-PDF:en,
// e-posten och adminlistorna (verifierat: 3-sidig PDF av en enradsfaktura).
const singleLine = (min: number, minMessage: string, max: number) =>
  z
    .string()
    // \p{Cc} = kontrolltecken, \p{Cf} = osynliga formattecken (zero-width, RTL-override).
    .transform((s) => s.replace(/[\p{Cc}\p{Cf}\s]+/gu, " ").trim())
    .pipe(z.string().min(min, minMessage).max(max));

// Flerradsfält: radbrytningar tillåts men övriga kontrolltecken tas bort och
// antalet rader begränsas (fakturans adressblock har fast höjd).
const multiLine = (max: number, maxLines: number) =>
  z
    .string()
    .transform((s) =>
      s
        .replace(/\r\n?/g, "\n")
        .replace(/[^\P{Cc}\n]|\p{Cf}/gu, "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l, i, arr) => l.length > 0 || i === arr.length - 1)
        .slice(0, maxLines)
        .join("\n")
        .trim()
    )
    .pipe(z.string().max(max))
    .default("");

// E-post normaliseras till gemener vid lagring — då fungerar dygnsspärrar och
// uppslag med vanlig likhet i alla databaser (SQLite i demo, Postgres i prod).
const emailSchema = (message: string) =>
  z.string().trim().email(message).max(200).transform((s) => s.toLowerCase());

// Honeypot: fältet är dolt i formuläret och ska alltid vara tomt. Ifyllt
// värde = bot; avvisas med ett vanligt valideringsfel utan att avslöja varför.
// Nyckeln är medvetet intetsägande ("website" autofylls av lösenordshanterare).
const honeypotSchema = z.string().max(0, "Kontrollera uppgifterna").optional();

// Svenska organisationsnummer har Luhn-kontrollsiffra — ett formatriktigt men
// påhittat nummer (556677-8899 är t.ex. ogiltigt) ska inte kunna faktureras.
export function isValidOrgNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const orgNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{6}-?\d{4}$/, "Ange organisationsnummer i formatet 556677-8899")
  .refine(isValidOrgNumber, "Organisationsnumret verkar inte stämma — kontrollera siffrorna")
  .transform((v) => (v.includes("-") ? v : `${v.slice(0, 6)}-${v.slice(6)}`));

const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{3}\s?\d{2}$/, "Ange postnummer i formatet 135 48");

const phoneSchema = z
  .string()
  .trim()
  .min(6, "Ange ett telefonnummer")
  .max(25)
  .regex(/^[0-9+\-() ]+$/, "Ogiltigt telefonnummer");

// strictObject: okända fält (t.ex. klientskickade priser) avvisas i stället
// för att tyst strippas — API-kontraktet är exakt.
export const orderItemInputSchema = z.strictObject({
  productId: z.string().min(1),
  weightKg: z.number().int("Antal anges i hela enheter (kilo eller paket)").min(1).max(100),
});

// Tak + dubblettspärr: utan dem kan ett enda anrop skapa en gigantisk
// order/faktura/PDF genom att upprepa samma produktrad tusentals gånger.
const itemsSchema = z
  .array(orderItemInputSchema)
  .min(1, "Välj minst en kaka")
  .max(30, "För många orderrader")
  .refine(
    (items) => new Set(items.map((i) => i.productId)).size === items.length,
    "Samma produkt får bara förekomma en gång"
  );

const idempotencyKeySchema = z.string().regex(/^[a-zA-Z0-9-]{16,64}$/);

// Cloudflare Turnstile-token (endast när robotskyddet är aktiverat via env).
const turnstileTokenSchema = z.string().max(4096).optional();

export const checkoutSchema = z.strictObject({
  // Skydd mot dubbelbeställning — klienten genererar en nyckel per försök.
  idempotencyKey: idempotencyKeySchema.optional(),
  items: itemsSchema,
  areaSlug: z.string().min(1, "Välj leveransområde"),
  deliveryDate: isoDateSchema("Välj leveransdag"),

  companyName: singleLine(2, "Ange företagsnamn", 120),
  orgNumber: orgNumberSchema,
  contactName: singleLine(2, "Ange kontaktperson", 120),
  email: emailSchema("Ange en giltig e-postadress"),
  phone: phoneSchema,

  deliveryAddress: singleLine(3, "Ange leveransadress", 200),
  deliveryPostalCode: postalCodeSchema,
  deliveryCity: singleLine(2, "Ange ort", 80),
  deliveryInstruction: multiLine(500, 6),

  invoiceEmail: emailSchema("Ange en giltig faktura-e-post"),
  reference: singleLine(0, "", 120).default(""),
  billingAddress: multiLine(300, 4),

  // Belopp kunden såg när hen bekräftade — servern räknar alltid själv, men
  // avviker summorna (pris ändrat i admin under tiden) avvisas ordern så att
  // kunden får bekräfta det nya priset i stället för att faktureras tyst.
  expectedTotalOre: z.number().int().min(0).optional(),
  sb_extra: honeypotSchema,
  turnstileToken: turnstileTokenSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const subscriptionSchema = z.strictObject({
  // Skydd mot dubbelstart av prenumeration (nätverksretry/dubbelklick).
  idempotencyKey: idempotencyKeySchema.optional(),
  items: itemsSchema,
  frequency: z.enum(SUBSCRIPTION_FREQUENCY),
  areaSlug: z.string().min(1, "Välj leveransområde"),
  firstDeliveryDate: isoDateSchema("Välj första leveransdag"),

  companyName: singleLine(2, "Ange företagsnamn", 120),
  orgNumber: orgNumberSchema,
  contactName: singleLine(2, "Ange kontaktperson", 120),
  email: emailSchema("Ange en giltig e-postadress"),
  // Chauffören behöver ett nummer även på prenumerationsleveranser — samma krav som checkouten.
  phone: phoneSchema,

  deliveryAddress: singleLine(3, "Ange leveransadress", 200),
  deliveryPostalCode: postalCodeSchema,
  deliveryCity: singleLine(2, "Ange ort", 80),
  deliveryInstruction: multiLine(500, 6),

  invoiceEmail: emailSchema("Ange en giltig faktura-e-post"),
  reference: singleLine(0, "", 120).default(""),

  expectedTotalOre: z.number().int().min(0).optional(),
  sb_extra: honeypotSchema,
  turnstileToken: turnstileTokenSchema,
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

/** Plattar ut zod-fel till { fältnamn: meddelande } för formulärvisning. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

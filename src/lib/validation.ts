import { z } from "zod";
import { SUBSCRIPTION_FREQUENCY } from "@/lib/status";

// Server-side validering — frontendvalidering är UX, inte säkerhet.

const orgNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{6}-?\d{4}$/, "Ange organisationsnummer i formatet 556677-8899");

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
  weightKg: z.number().int("Vikt anges i hela kilo").min(1).max(100),
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

export const checkoutSchema = z.strictObject({
  // Skydd mot dubbelbeställning — klienten genererar en nyckel per försök.
  idempotencyKey: idempotencyKeySchema.optional(),
  items: itemsSchema,
  areaSlug: z.string().min(1, "Välj leveransområde"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Välj leveransdag"),

  companyName: z.string().trim().min(2, "Ange företagsnamn").max(120),
  orgNumber: orgNumberSchema,
  contactName: z.string().trim().min(2, "Ange kontaktperson").max(120),
  email: z.string().trim().email("Ange en giltig e-postadress").max(200),
  phone: phoneSchema,

  deliveryAddress: z.string().trim().min(3, "Ange leveransadress").max(200),
  deliveryPostalCode: postalCodeSchema,
  deliveryCity: z.string().trim().min(2, "Ange ort").max(80),
  deliveryInstruction: z.string().trim().max(500).default(""),

  invoiceEmail: z.string().trim().email("Ange en giltig faktura-e-post").max(200),
  reference: z.string().trim().max(120).default(""),
  billingAddress: z.string().trim().max(300).default(""),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const subscriptionSchema = z.strictObject({
  // Skydd mot dubbelstart av prenumeration (nätverksretry/dubbelklick).
  idempotencyKey: idempotencyKeySchema.optional(),
  items: itemsSchema,
  frequency: z.enum(SUBSCRIPTION_FREQUENCY),
  areaSlug: z.string().min(1, "Välj leveransområde"),
  firstDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Välj första leveransdag"),

  companyName: z.string().trim().min(2, "Ange företagsnamn").max(120),
  orgNumber: orgNumberSchema,
  contactName: z.string().trim().min(2, "Ange kontaktperson").max(120),
  email: z.string().trim().email("Ange en giltig e-postadress").max(200),
  phone: phoneSchema.or(z.literal("")).default(""),

  deliveryAddress: z.string().trim().min(3, "Ange leveransadress").max(200),
  deliveryPostalCode: postalCodeSchema,
  deliveryCity: z.string().trim().min(2, "Ange ort").max(80),
  deliveryInstruction: z.string().trim().max(500).default(""),

  invoiceEmail: z.string().trim().email("Ange en giltig faktura-e-post").max(200),
  reference: z.string().trim().max(120).default(""),
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

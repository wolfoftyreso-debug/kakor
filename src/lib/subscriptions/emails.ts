import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailConfig, siteConfig } from "@/lib/config";
import { FREQUENCY_LABELS } from "@/lib/status";
import { capitalizeFirst, formatDeliveryDateWithYear, isoWeekday, weekdayName } from "@/lib/dates";

// Kundmejl om själva prenumerationen (inte om enskilda ordrar). Kunden har
// ingen inloggning: varje ändring verksamheten gör måste bekräftas skriftligt,
// annars vet kunden inte om "pausa över jul" faktiskt blev gjort.
// Inga funktioner här kastar – ett mejl som fallerar ska aldrig stoppa åtgärden.

type SubscriptionForMail = {
  id: string;
  number: string;
  email: string;
  frequency: string;
  nextDeliveryDate: Date;
};

const frequencyLabel = (f: string) => (FREQUENCY_LABELS[f as keyof typeof FREQUENCY_LABELS] ?? f).toLowerCase();
const weekdayPlural = (d: Date) => `${weekdayName(isoWeekday(d))}ar`;

/** Samma mejl ska inte gå två gånger (cronen körs dagligen, admin kan dubbelklicka). */
async function alreadySent(type: string, subjectContains: string, days = 21): Promise<boolean> {
  try {
    const hit = await prisma.emailLog.findFirst({
      where: {
        type,
        status: "SENT",
        subject: { contains: subjectContains },
        createdAt: { gte: new Date(Date.now() - days * 86_400_000) },
      },
      select: { id: true },
    });
    return !!hit;
  } catch {
    return false;
  }
}

export type SubscriptionChangeKind = "PAUSED" | "RESUMED" | "CANCELLED" | "UPDATED" | "DATE_CHANGED";

/** Bekräftar en ändring verksamheten gjort i admin. `detail` = t.ex. ny sammansättning. */
export async function sendSubscriptionChangeEmail(
  subscriptionId: string,
  kind: SubscriptionChangeKind,
  detail?: string
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, number: true, email: true, frequency: true, nextDeliveryDate: true },
  });
  if (!sub) return false;
  const next = `${capitalizeFirst(formatDeliveryDateWithYear(sub.nextDeliveryDate))}, därefter ${frequencyLabel(sub.frequency)} på ${weekdayPlural(sub.nextDeliveryDate)}`;
  const texts: Record<SubscriptionChangeKind, { subject: string; body: string }> = {
    PAUSED: {
      subject: `Fikaprenumeration ${sub.number} är pausad – Sockerbagaren`,
      body: `Er fikaprenumeration ${sub.number} är nu pausad.

Inga nya leveranser eller fakturor skapas förrän ni hör av er. En leverans som redan har bekräftats med orderbekräftelse påverkas inte av pausen – den levereras och faktureras som vanligt om ni inte avbokar den separat.

Vill ni starta igen? Svara på det här mejlet så sätter vi ett nytt första leveransdatum.`,
    },
    RESUMED: {
      subject: `Fikaprenumeration ${sub.number} är igång igen – Sockerbagaren`,
      body: `Er fikaprenumeration ${sub.number} är igång igen.

Nästa leverans: ${next}.
Några dagar före varje leverans får ni en orderbekräftelse med faktura, precis som tidigare.`,
    },
    CANCELLED: {
      subject: `Fikaprenumeration ${sub.number} är avslutad – Sockerbagaren`,
      body: `Er fikaprenumeration ${sub.number} är nu avslutad.

Inga fler leveranser eller fakturor skapas. Fakturor som redan skickats gäller som vanligt.

Tack för den här tiden – ni är välkomna tillbaka när som helst: ${siteConfig.url}/bestall`,
    },
    UPDATED: {
      subject: `Fikaprenumeration ${sub.number} är ändrad – Sockerbagaren`,
      body: `Vi har uppdaterat er fikaprenumeration ${sub.number} enligt önskemål.

Gäller från nästa leverans: ${detail ?? ""}
Nästa leverans: ${next}.

Stämmer det inte? Svara på det här mejlet så rättar vi till det.`,
    },
    DATE_CHANGED: {
      subject: `Fikaprenumeration ${sub.number}: ny leveransdag – Sockerbagaren`,
      body: `Nästa leverans i er fikaprenumeration ${sub.number} är flyttad.

Nästa leverans: ${next}.
Några dagar före leveransen får ni en orderbekräftelse med faktura som vanligt.`,
    },
  };
  const t = texts[kind];
  return sendEmail({
    to: sub.email,
    subject: t.subject,
    text: `${t.body}

Vänliga hälsningar
Sockerbagaren`,
    type: "SUBSCRIPTION_CHANGE",
  });
}

/**
 * Kunden ska inte vänta på kakor som inte kommer: när en ordinarie leveransdag
 * är helgdag eller spärrad och leveransen därför utgår, mejlas det en gång.
 */
export async function notifyCustomerSkippedDelivery(
  sub: SubscriptionForMail,
  skippedDate: Date,
  nextDate: Date,
  why: string
): Promise<boolean> {
  const subject = `Ingen fikaleverans ${formatDeliveryDateWithYear(skippedDate)} (${sub.number}) – Sockerbagaren`;
  if (await alreadySent("SUBSCRIPTION_SKIPPED", subject)) return false;
  return sendEmail({
    to: sub.email,
    subject,
    text: `${capitalizeFirst(formatDeliveryDateWithYear(skippedDate))} ${why} – den leveransen i er fikaprenumeration ${sub.number} utgår, och ni faktureras inget för den.

Nästa leverans planeras till ${formatDeliveryDateWithYear(nextDate)}. Några dagar innan får ni en orderbekräftelse med faktura som vanligt.

Vill ni ha en extra leverans en annan dag? Beställ som vanligt på ${siteConfig.url}/bestall eller svara på det här mejlet.

Vänliga hälsningar
Sockerbagaren`,
    type: "SUBSCRIPTION_SKIPPED",
  });
}

/** Verksamheten måste få veta när en prenumeration inte kunde generera order – ett cron-svar läser ingen. */
export async function notifyAdminSkippedSubscription(sub: { number: string; id: string }, period: string, reason: string): Promise<boolean> {
  if (!emailConfig.adminNotify) return false;
  const subject = `Prenumeration ${sub.number} skapade ingen order för ${period}`;
  if (await alreadySent("ADMIN_SUBSCRIPTION_SKIPPED", subject, 7)) return false;
  return sendEmail({
    to: emailConfig.adminNotify,
    subject,
    text: `Prenumerationen ${sub.number} kunde inte generera någon order för ${period}.

Orsak: ${reason}

Kunden har inte fått något mejl om detta. Åtgärda i admin och meddela kunden vid behov:
${siteConfig.url}/admin/prenumerationer`,
    type: "ADMIN_SUBSCRIPTION_SKIPPED",
  });
}

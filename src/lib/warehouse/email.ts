import { sendEmail } from "@/lib/email";
import { capitalizeFirst, formatDeliveryDateWithYear, fromISODate } from "@/lib/dates";
import { formatWeightKg, qtyLabel } from "@/lib/units";
import { getOpsSettings, resolveOpsRecipients } from "./settings";
import { renderAllOpsPdfs } from "./pdf";
import type { DeliverySnapshot } from "./types";

function kg(grams: number): string {
  return formatWeightKg(grams);
}

export async function sendLockEmail(snapshot: DeliverySnapshot): Promise<boolean> {
  const settings = await getOpsSettings();
  const recipients = resolveOpsRecipients(settings);
  if (recipients.length === 0) {
    console.warn("[lager] inget driftmejl konfigurerat – hoppar över utskick");
    return true; // inget att skicka = inte ett fel som ska retrys:as i evighet
  }
  const dateLabel = capitalizeFirst(formatDeliveryDateWithYear(fromISODate(snapshot.deliveryDate)));
  const warnings = snapshot.byProduct.filter((p) => p.productionNeedGrams > 0);
  const needLines =
    warnings.length === 0
      ? "Inget produktionsunderskott mot fysiskt lager."
      : warnings.map((p) => `· ${p.name}: +${kg(p.productionNeedGrams)}`).join("\n");

  const productLines = snapshot.byProduct.map((p) => `· ${p.name}: ${qtyLabel(p.qty, p.unit)}`).join("\n");
  const text = [
    `Leveranslista ${dateLabel}`,
    "",
    `${snapshot.orderCount} leveranser`,
    `Totalt ${kg(snapshot.totalGrams)}`,
    "",
    "Per sort:",
    productLines || "· (inga rader)",
    "",
    "Produktionsbehov (beställt minus fysiskt lager):",
    needLines,
    "",
    "Bifogat: leveranslista, plocklista och leveranssedlar (PDF).",
    "Låst lista är oföränderlig – efterhandsändringar registreras separat.",
  ].join("\n");

  const pdfs = await renderAllOpsPdfs(snapshot);
  const iso = snapshot.deliveryDate;
  const attachments = [
    { filename: `leveranslista-${iso}.pdf`, content: pdfs.lista, contentType: "application/pdf" },
    { filename: `plocklista-${iso}.pdf`, content: pdfs.plock, contentType: "application/pdf" },
    { filename: `leveranssedlar-${iso}.pdf`, content: pdfs.sedlar, contentType: "application/pdf" },
  ];

  let any = false;
  for (const to of recipients) {
    const ok = await sendEmail({
      to,
      subject: `Sockerbagaren – Leveranslista ${dateLabel}`,
      text,
      type: "DELIVERY_WEEK_LOCK",
      attachments,
    });
    if (ok) any = true;
  }
  return any;
}

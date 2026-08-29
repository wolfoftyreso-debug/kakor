import { prisma } from "@/lib/db";
import { emailConfig } from "@/lib/config";

// E-postabstraktion: orderlogiken känner bara till sendEmail().
// Provider byts via EMAIL_PROVIDER utan att någon affärslogik ändras.
// Regel: e-postfel får ALDRIG fälla orderflödet — allt loggas i EmailLog.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  /** Typ för loggning, t.ex. ORDER_CONFIRMATION / INVOICE. */
  type: string;
  orderId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}

class LogProvider implements EmailProvider {
  readonly name = "log";
  async send(msg: EmailMessage): Promise<void> {
    console.log(
      `[email:log] to=${msg.to} subject="${msg.subject}" attachments=${msg.attachments?.length ?? 0}`
    );
  }
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  async send(msg: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailConfig.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailConfig.from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        attachments: msg.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${body.slice(0, 500)}`);
    }
  }
}

function getProvider(): EmailProvider {
  if (emailConfig.provider === "resend" && emailConfig.resendApiKey) return new ResendProvider();
  return new LogProvider();
}

/**
 * Skickar e-post och loggar leveransstatus. Kastar aldrig —
 * returnerar true/false så att anroparen kan fortsätta oavsett.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const provider = getProvider();
  let status = "SENT";
  let error = "";
  try {
    await provider.send(msg);
  } catch (e) {
    status = "FAILED";
    error = e instanceof Error ? e.message : String(e);
    console.error(`E-post misslyckades (${msg.type} till ${msg.to}):`, error);
  }
  try {
    await prisma.emailLog.create({
      data: {
        to: msg.to,
        subject: msg.subject,
        type: msg.type,
        provider: provider.name,
        status,
        error,
        orderId: msg.orderId,
      },
    });
  } catch (logErr) {
    console.error("Kunde inte logga e-post:", logErr);
  }
  return status === "SENT";
}

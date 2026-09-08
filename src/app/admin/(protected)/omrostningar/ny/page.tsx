import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { toStockholmLocal } from "@/lib/polls/time";
import { PollForm } from "../PollForm";

export const dynamic = "force-dynamic";

export default async function NewPollPage() {
  await requireAdminPage();
  const last = await prisma.poll.findFirst({ orderBy: { sequence: "desc" }, select: { sequence: true } });
  const sequence = (last?.sequence ?? 0) + 1;
  const now = new Date();
  const inThreeMonths = new Date(now.getTime() + 90 * 86_400_000);
  return (
    <>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin/omrostningar">← Omröstningar</Link>
      </p>
      <h1 style={{ fontSize: 26, marginBottom: 16 }}>Ny omgång: Folkets val {sequence}</h1>
      <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 18px", maxWidth: "70ch" }}>
        Skapa omgången som utkast, lägg till kandidater, och öppna den när allt är klart. Datum anges i svensk tid.
      </p>
      <PollForm
        pollId={null}
        initial={{
          slug: `folkets-nasta-smakaka-${sequence}`,
          sequence,
          title: "Vilken klassiker ska vi baka härnäst?",
          intro: "Vi vill väcka recepten ur Svenskt konditorlexikon till liv igen. Nu får ni bestämma vilken småkaka som blir nästa i Sockerbagarens sortiment.",
          deadlineLabel: "",
          startsAt: toStockholmLocal(now),
          endsAt: toStockholmLocal(inThreeMonths),
          status: "DRAFT",
        }}
      />
    </>
  );
}

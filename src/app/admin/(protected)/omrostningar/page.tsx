import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { getResults, pollInclude, pollState } from "@/lib/polls/service";
import { formatLongDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<string, string> = { DRAFT: "Utkast", UPCOMING: "Kommande", OPEN: "Öppen", CLOSED: "Stängd", WINNER: "Vinnare utsedd", LAUNCHED: "Lanserad" };

export default async function PollsPage() {
  await requireAdminPage();
  const polls = await prisma.poll.findMany({ include: pollInclude, orderBy: { sequence: "desc" } });
  const rows = await Promise.all(polls.map(async (p) => ({ poll: p, state: pollState(p), results: await getResults(p) })));
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 26 }}>Omröstningar</h1>
        <Link href="/admin/omrostningar/ny" className="btn btn-primary" style={{ padding: "10px 18px", fontSize: 14 }}>
          Ny omgång
        </Link>
      </div>
      <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 20px", maxWidth: "70ch" }}>
        Folkets nästa småkaka: kunderna röstar på vilket recept ur Svenskt konditorlexikon som blir nästa i sortimentet. Statusen räknas från datumen på servern; alla siffror är riktiga röster.
      </p>
      {rows.length === 0 ? (
        <p style={{ color: "var(--text-2)" }}>Inga omgångar ännu.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map(({ poll, state, results }) => (
            <div key={poll.id} className="card" style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <div>
                  <strong style={{ fontSize: 16 }}>Folkets val {poll.sequence}: {poll.title}</strong>
                  <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 2 }}>
                    {STATE_LABEL[state] ?? state} · {formatLongDate(poll.startsAt)} – {formatLongDate(poll.endsAt)} · {results.total} röster
                  </div>
                </div>
                <Link href={`/admin/omrostningar/${poll.id}`} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: 13 }}>
                  Öppna
                </Link>
              </div>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 14 }}>
                {results.candidates.map((c) => (
                  <li key={c.id}>
                    {c.name} – {c.votes} ({c.percent} %){poll.winnerCandidateId === c.id ? " · vinnare" : results.leaderId === c.id && !poll.winnerCandidateId ? " · leder" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

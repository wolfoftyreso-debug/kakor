import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { getResults, pollInclude, pollState, suspiciousActivity } from "@/lib/polls/service";
import { toStockholmLocal } from "@/lib/polls/time";
import { formatLongDate } from "@/lib/dates";
import { PollForm } from "../PollForm";
import { CandidateForm } from "../CandidateForm";
import { PollControls } from "../PollControls";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<string, string> = { DRAFT: "Utkast", UPCOMING: "Kommande", OPEN: "Öppen", CLOSED: "Stängd", WINNER: "Vinnare utsedd", LAUNCHED: "Lanserad" };

export default async function PollAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sparad?: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const { sparad } = await searchParams;
  if (!/^[a-z0-9]{20,40}$/.test(id)) notFound();
  const poll = await prisma.poll.findUnique({ where: { id }, include: pollInclude });
  if (!poll) notFound();
  const [results, suspicious, products, signups, perDay] = await Promise.all([
    getResults(poll),
    suspiciousActivity(poll.id),
    prisma.product.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.pollWinnerSignup.findMany({ where: { pollId: poll.id }, orderBy: { createdAt: "asc" }, select: { email: true, createdAt: true } }),
    prisma.pollVote.findMany({ where: { pollId: poll.id }, select: { createdAt: true } }),
  ]);
  const state = pollState(poll);
  // Utveckling per dag (svensk tid) – de senaste 14 dagarna med röster.
  const byDay = new Map<string, number>();
  for (const v of perDay) {
    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(v.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14);

  return (
    <>
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/admin/omrostningar">← Omröstningar</Link>
      </p>
      {sparad && (
        <div role="status" className="info-box" style={{ marginBottom: 16, fontSize: 14 }}>
          Sparat.
        </div>
      )}
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Folkets val {poll.sequence}: {poll.title}</h1>
      <p style={{ color: "var(--text-2)", fontSize: 13.5, margin: "0 0 18px" }}>
        {STATE_LABEL[state] ?? state} · {formatLongDate(poll.startsAt)} – {formatLongDate(poll.endsAt)} · <a href="/folkets-kaka" target="_blank" rel="noopener">Visa publikt</a>
      </p>

      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Resultat</h2>
      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.8 }}>
          {results.candidates.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong> – {c.votes} röster ({c.percent} %)
              {poll.winnerCandidateId === c.id ? " · vinnare" : results.leaderId === c.id && !poll.winnerCandidateId ? " · leder" : ""}
            </li>
          ))}
        </ul>
        <p style={{ margin: "10px 0 0", fontSize: 14 }}>
          Totalt: <strong>{results.total}</strong> röster · {signups.length} vill bli meddelade när vinnaren går att beställa
        </p>
        {days.length > 0 && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-2)" }}>
            Per dag: {days.map(([d, n]) => `${d}: ${n}`).join(" · ")}
          </p>
        )}
        {suspicious.length > 0 ? (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--red)" }}>
            Misstänkt aktivitet: {suspicious.length} IP-adresser med minst 3 röster var ({suspicious.map((s) => `${s.ipHash.slice(0, 8)}…: ${s.votes}`).join(", ")}). Röster från samma nätverk kan vara ett kontor – men också ett skript.
          </p>
        ) : (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-2)" }}>Ingen IP-adress har lämnat fler än två röster.</p>
        )}
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Styra omgången</h2>
      <div style={{ marginBottom: 18 }}>
        <PollControls
          pollId={poll.id}
          status={poll.status}
          state={STATE_LABEL[state] ?? state}
          winnerId={poll.winnerCandidateId}
          leaderId={results.leaderId}
          candidates={poll.candidates.map((c) => ({ id: c.id, name: c.name, votes: results.candidates.find((r) => r.id === c.id)?.votes ?? 0, productId: c.productId }))}
          products={products}
        />
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Omgången</h2>
      <div style={{ marginBottom: 18 }}>
        <PollForm
          pollId={poll.id}
          initial={{
            slug: poll.slug,
            sequence: poll.sequence,
            title: poll.title,
            intro: poll.intro,
            deadlineLabel: poll.deadlineLabel,
            startsAt: toStockholmLocal(poll.startsAt),
            endsAt: toStockholmLocal(poll.endsAt),
            status: poll.status,
          }}
        />
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Kandidater</h2>
      <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
        {poll.candidates.map((c) => (
          <details key={c.id} className="card" style={{ padding: "14px 18px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14.5 }}>
              {c.displayOrder}. {c.name} · {results.candidates.find((r) => r.id === c.id)?.votes ?? 0} röster{c.imageRef ? "" : " · bild saknas"}
            </summary>
            <div style={{ marginTop: 12 }}>
              <CandidateForm pollId={poll.id} candidateId={c.id} initial={{ name: c.name, slug: c.slug, description: c.description, tradition: c.tradition, imageRef: c.imageRef, displayOrder: c.displayOrder, sourceReference: c.sourceReference }} />
            </div>
          </details>
        ))}
        <details className="card" style={{ padding: "14px 18px" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14.5 }}>Lägg till kandidat</summary>
          <div style={{ marginTop: 12 }}>
            <CandidateForm pollId={poll.id} candidateId={null} initial={{ name: "", slug: "", description: "", tradition: "", imageRef: "", displayOrder: poll.candidates.length + 1, sourceReference: "" }} />
          </div>
        </details>
      </div>

      {signups.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Vill bli meddelade ({signups.length})</h2>
          <div className="card" style={{ padding: 18, fontSize: 13.5 }}>
            <p style={{ margin: "0 0 8px", color: "var(--text-2)" }}>Adresserna får bara användas för beskedet om vinnaren, och raderas efter utskicket.</p>
            <textarea readOnly rows={Math.min(8, signups.length + 1)} value={signups.map((s) => s.email).join("\n")} style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, border: "1px solid var(--input-border)", borderRadius: 6, padding: 8, background: "var(--surface)" }} />
          </div>
        </>
      )}
    </>
  );
}

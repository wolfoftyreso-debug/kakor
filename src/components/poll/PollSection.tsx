import { cookies } from "next/headers";
import Link from "next/link";
import { daysLeft, getCurrentPoll, getResults, getVisitorVote, pollState, type PollWithCandidates } from "@/lib/polls/service";
import { VISITOR_COOKIE } from "@/lib/polls/visitor";
import { formatLongDate } from "@/lib/dates";
import { PollWidget, type PollView } from "@/components/poll/PollWidget";

// Serverdelen: läser aktuell omgång, besökarens eventuella röst (kakan) och
// resultatet när det får visas. Resultatet skickas ALDRIG till en besökare
// som inte röstat i en öppen omgång – kandidaterna ska stå i fokus först.

export function toPollView(poll: PollWithCandidates, now = new Date()): PollView {
  return {
    slug: poll.slug,
    sequence: poll.sequence,
    title: poll.title,
    intro: poll.intro,
    deadlineLabel: poll.deadlineLabel,
    endsAtIso: poll.endsAt.toISOString(),
    endsAtText: formatLongDate(poll.endsAt),
    daysLeft: daysLeft(poll.endsAt, now),
    state: pollState(poll, now),
    winnerId: poll.winnerCandidateId,
    candidates: poll.candidates.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      tradition: c.tradition,
      imageRef: c.imageRef,
      product: c.product ? { slug: c.product.slug, name: c.product.name, active: c.product.active } : null,
    })),
  };
}

export async function loadPollForVisitor(poll: PollWithCandidates) {
  const now = new Date();
  const view = toPollView(poll, now);
  const cookieStore = await cookies();
  const vote = await getVisitorVote(poll.id, cookieStore.get(VISITOR_COOKIE)?.value);
  const results = vote || view.state !== "OPEN" ? await getResults(poll) : null;
  return { view, vote: vote?.candidateId ?? null, results };
}

/**
 * Sektionen som visas på startsidan (kompakt) och på /folkets-kaka (full).
 * Renderar ingenting när ingen omgång finns att visa.
 */
export async function PollSection({ variant, placement, showLink = true }: { variant: "full" | "compact"; placement: string; showLink?: boolean }) {
  const poll = await getCurrentPoll();
  if (!poll) return null;
  const { view, vote, results } = await loadPollForVisitor(poll);
  return (
    <div className="poll-section">
      <PollWidget poll={view} initialVote={vote} initialResults={results} variant={variant} placement={placement} />
      {showLink && (
        <p className="poll-more">
          <Link href="/folkets-kaka" className="section-link">Hela berättelsen om Folkets nästa småkaka →</Link>
        </p>
      )}
    </div>
  );
}

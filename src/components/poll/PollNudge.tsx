import Link from "next/link";
import { getCurrentPoll, pollState } from "@/lib/polls/service";

/** Liten kontextuell hänvisning på sortiment och i kassan – bara när en omgång är öppen. */
export async function PollNudge({ compact = false }: { compact?: boolean }) {
  const poll = await getCurrentPoll();
  if (!poll || pollState(poll) !== "OPEN") return null;
  return (
    <p className={`poll-nudge${compact ? " poll-nudge--compact" : ""}`}>
      Saknar du din favorit? <Link href="/folkets-kaka">Rösta på vilken klassiker vi ska baka härnäst →</Link>
    </p>
  );
}

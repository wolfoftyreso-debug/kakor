"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImageSlot } from "@/components/ImageSlot";
import { track } from "@/lib/analytics";
import type { PollResults, PollState } from "@/lib/polls/service";

// Folkets nästa småkaka – röstningen. Alla siffror kommer från servern.
// Tillstånd: före röst, vald, skickar, lyckad, redan röstat, stängd,
// vinnare utsedd, vinnare lanserad, fel/offline.

export interface PollCandidateView {
  id: string;
  slug: string;
  name: string;
  description: string;
  tradition: string;
  imageRef: string;
  product: { slug: string; name: string; active: boolean } | null;
}

export interface PollView {
  slug: string;
  sequence: number;
  title: string;
  intro: string;
  deadlineLabel: string;
  endsAtIso: string;
  endsAtText: string;
  daysLeft: number;
  state: PollState;
  winnerId: string | null;
  candidates: PollCandidateView[];
}

const nf = new Intl.NumberFormat("sv-SE");

export function PollWidget({
  poll,
  initialVote,
  initialResults,
  variant = "full",
  placement,
}: {
  poll: PollView;
  /** Kandidat-id besökaren redan röstat på (från besökskakan), annars null. */
  initialVote: string | null;
  /** Resultat att visa direkt (redan röstat eller avslutad omgång). */
  initialResults: PollResults | null;
  variant?: "full" | "compact";
  /** Var på sajten komponenten visas – för analys av var röstningen upptäcks. */
  placement: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState<string | null>(initialVote);
  const [results, setResults] = useState<PollResults | null>(initialResults);
  const [justVoted, setJustVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [signup, setSignup] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [signupError, setSignupError] = useState<string | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track("poll_viewed", { poll: poll.slug, placement, state: poll.state });
    if (results && (voted || poll.state !== "OPEN")) track("poll_results_viewed", { poll: poll.slug, placement, reason: voted ? "already_voted" : poll.state.toLowerCase() });
    // Medvetet bara vid första renderingen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!justVoted) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.getElementById("folkets-kaka") ?? liveRef.current;
    target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    liveRef.current?.focus({ preventScroll: true });
  }, [justVoted]);

  const open = poll.state === "OPEN";
  const winner = poll.winnerId ? poll.candidates.find((c) => c.id === poll.winnerId) ?? null : null;
  const selectedCandidate = poll.candidates.find((c) => c.id === selected) ?? null;

  const submit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    track("poll_vote_submitted", { poll: poll.slug, candidate: selectedCandidate?.slug ?? "", placement });
    try {
      const res = await fetch(`/api/polls/${poll.slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: selected }),
      });
      const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
      const data = isJson ? await res.json() : { ok: false, error: `Servern svarade med fel ${res.status} – försök igen om en stund.` };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Rösten kunde inte registreras – försök igen.");
        return;
      }
      setVoted(data.candidateId);
      setResults(data.results);
      setJustVoted(!data.already);
      track(data.already ? "poll_results_viewed" : "poll_vote_success", { poll: poll.slug, candidate: selectedCandidate?.slug ?? "", placement, reason: data.already ? "already_voted" : "vote" });
      if (!data.already) track("poll_results_viewed", { poll: poll.slug, placement, reason: "after_vote" });
    } catch {
      setError("Vi når inte servern just nu. Kontrollera uppkopplingen och försök igen – din röst är inte registrerad.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendSignup = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setSignupError("Ange en giltig e-postadress");
      return;
    }
    setSignup("sending");
    setSignupError(null);
    try {
      const res = await fetch(`/api/polls/${poll.slug}/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setSignup("error");
        setSignupError(data.error ?? "Kunde inte spara – försök igen.");
        return;
      }
      setSignup("done");
      track("winner_notification_signup", { poll: poll.slug, placement });
    } catch {
      setSignup("error");
      setSignupError("Vi når inte servern just nu – försök igen om en stund.");
    }
  };

  const votedCandidate = voted ? poll.candidates.find((c) => c.id === voted) ?? null : null;
  const leader = results?.leaderId ? poll.candidates.find((c) => c.id === results.leaderId) ?? null : null;
  const showResults = !!results && (!!voted || !open);

  // ---- Vinnare lanserad ----
  if (poll.state === "LAUNCHED" && winner?.product) {
    return (
      <div className="poll poll--done">
        <div className="rule-label">Folkets val {poll.sequence}</div>
        <h3 className="poll-title">{winner.name}</h3>
        <p className="poll-lede">Framröstad av våra kunder {new Date(poll.endsAtIso).getFullYear()}. {results ? `${nf.format(results.total)} personer var med och röstade.` : ""}</p>
        <Link href={`/kakor/${winner.product.slug}`} className="btn btn-primary btn-lg">Beställ {winner.name}</Link>
      </div>
    );
  }

  // ---- Vinnare utsedd, ännu inte lanserad ----
  if (poll.state === "WINNER" && winner) {
    return (
      <div className="poll poll--done">
        <div className="rule-label">Ni har valt</div>
        <h3 className="poll-title">{winner.name} blir nästa småkaka från Sockerbagaren.</h3>
        <p className="poll-lede">
          {results ? `${nf.format(results.total)} personer var med och röstade. ` : ""}
          Nu börjar arbetet med att baka fram vår version efter recepttraditionen i Svenskt konditorlexikon. Snart på kakfatet.
        </p>
        {results && <ResultBars results={results} candidates={poll.candidates} highlight={winner.id} />}
        <SignupBox state={signup} email={email} setEmail={setEmail} error={signupError} onSend={sendSignup} label={`Vill du veta när ${winner.name} går att beställa?`} />
      </div>
    );
  }

  // ---- Stängd, vinnaren inte utsedd än ----
  if (poll.state === "CLOSED") {
    return (
      <div className="poll poll--done">
        <div className="rule-label">Röstningen är avslutad</div>
        <h3 className="poll-title">Tack till alla som röstade.</h3>
        <p className="poll-lede">{results ? `${nf.format(results.total)} personer var med. ` : ""}Vi räknar rösterna och berättar snart vilken klassiker som blir nästa.</p>
        {results && results.total > 0 && <ResultBars results={results} candidates={poll.candidates} highlight={leader?.id ?? null} />}
        <SignupBox state={signup} email={email} setEmail={setEmail} error={signupError} onSend={sendSignup} label="Vill du veta när vinnaren går att beställa?" />
      </div>
    );
  }

  if (poll.state === "UPCOMING") {
    return (
      <div className="poll poll--done">
        <div className="rule-label">Snart</div>
        <h3 className="poll-title">Nästa omröstning öppnar snart.</h3>
        <p className="poll-lede">{poll.intro}</p>
      </div>
    );
  }

  // ---- Öppen: röstat eller inte ----
  return (
    <div className={`poll poll--${variant}`}>
      {showResults && votedCandidate ? (
        <div ref={liveRef} tabIndex={-1} role="status" aria-live="polite" className="poll-thanks">
          <h3 className="poll-title">{justVoted ? "Tack! Din röst är räknad." : "Du har redan röstat."}</h3>
          <p className="poll-lede">
            Du röstade på {votedCandidate.name}.{" "}
            {leader ? `Just nu leder ${leader.name}.` : results && results.total > 0 ? "Just nu är det jämnt." : ""}{" "}
            Röstningen avslutas {poll.deadlineLabel ? `på ${poll.deadlineLabel}` : poll.endsAtText}.
          </p>
        </div>
      ) : (
        <p className="poll-deadline">
          {poll.daysLeft <= 14
            ? poll.daysLeft === 0
              ? "Sista dagen att rösta – i dag."
              : `${poll.daysLeft} ${poll.daysLeft === 1 ? "dag" : "dagar"} kvar att rösta.`
            : `Röstningen avslutas ${poll.deadlineLabel ? `på ${poll.deadlineLabel}` : poll.endsAtText}.`}
        </p>
      )}

      {!showResults && (
        <>
          <div className="poll-grid" role="radiogroup" aria-label="Kandidater">
            {poll.candidates.map((c) => {
              const isSelected = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`poll-card${isSelected ? " selected" : ""}`}
                  onClick={() => {
                    setSelected(c.id);
                    setError(null);
                    track("poll_candidate_selected", { poll: poll.slug, candidate: c.slug, placement });
                  }}
                >
                  <span className="poll-card-media">
                    <ImageSlot label={c.name} src={c.imageRef || undefined} decorative sizes="(max-width: 700px) 100vw, 33vw" />
                  </span>
                  <span className="poll-card-body">
                    <span className="poll-card-name">{c.name}</span>
                    <span className="poll-card-desc">{c.description}</span>
                    {c.tradition && variant === "full" && <span className="poll-card-tradition">{c.tradition}</span>}
                    <span className="poll-card-pick" aria-hidden="true">{isSelected ? "✓ Vald" : "Välj"}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="error-text" style={{ margin: "14px 0 0" }}>{error}</p>
          )}
          <div className="poll-actions">
            <button type="button" className="btn btn-primary btn-lg" disabled={!selected || submitting} onClick={submit} aria-describedby="poll-hint">
              {submitting ? "Registrerar…" : selectedCandidate ? `Jag röstar på ${selectedCandidate.name}` : "Rösta på min favorit"}
            </button>
            <span id="poll-hint" className="poll-hint">{selected ? "En röst per person. Resultatet visas när du röstat." : "Välj en kaka ovan."}</span>
          </div>
        </>
      )}

      {showResults && results && (
        <>
          <ResultBars results={results} candidates={poll.candidates} highlight={voted} />
          <SignupBox state={signup} email={email} setEmail={setEmail} error={signupError} onSend={sendSignup} label="Vill du veta när vinnaren går att beställa?" />
        </>
      )}
    </div>
  );
}

function ResultBars({ results, candidates, highlight }: { results: PollResults; candidates: PollCandidateView[]; highlight: string | null }) {
  return (
    <div className="poll-results">
      <ol className="poll-bars" aria-label="Aktuell ställning">
        {results.candidates.map((r) => {
          const c = candidates.find((x) => x.id === r.id);
          const mine = r.id === highlight;
          return (
            <li key={r.id} className={mine ? "mine" : undefined}>
              <span className="poll-bar-fill" style={{ width: `${Math.max(r.percent, 0)}%` }} aria-hidden="true" />
              <span className="poll-bar-copy">
                <span className="poll-bar-name">
                  {c?.name ?? r.name}
                  {mine && <span className="poll-bar-badge">Min röst</span>}
                </span>
                <span className="poll-bar-pct">{r.percent}%</span>
              </span>
              <span className="visually-hidden">
                {nf.format(r.votes)} röster{mine ? ", din röst" : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="poll-total">{results.total === 1 ? "1 person har röstat" : `${nf.format(results.total)} personer har röstat`}</p>
    </div>
  );
}

function SignupBox({ state, email, setEmail, error, onSend, label }: { state: "idle" | "sending" | "done" | "error"; email: string; setEmail: (v: string) => void; error: string | null; onSend: () => void; label: string }) {
  if (state === "done") {
    return <p className="poll-signup-done" role="status">Tack – vi hör av oss när det är dags.</p>;
  }
  return (
    <form
      className="poll-signup"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <label htmlFor="poll-signup-email" className="poll-signup-label">{label} Frivilligt.</label>
      <div className="poll-signup-row">
        <input
          id="poll-signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="namn@foretaget.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "poll-signup-fel" : undefined}
        />
        <button type="submit" className="btn btn-outline" disabled={state === "sending"}>
          {state === "sending" ? "Sparar…" : "Meddela mig"}
        </button>
      </div>
      {error && <span id="poll-signup-fel" className="error-text">{error}</span>}
    </form>
  );
}

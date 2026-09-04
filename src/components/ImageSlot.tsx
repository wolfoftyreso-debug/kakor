"use client";

// Bildyta. Om en riktig bild (t.ex. produktens bildreferens i /public) finns
// visas den via next/image (responsiva storlekar, WebP/AVIF, lazy) — annars,
// eller om filen saknas, en varsam platshållare i varumärkets färger tills
// foton enligt designpaketets shot list levereras.
// Inga AI-genererade eller lånade foton används.

import Image from "next/image";
import { useState } from "react";

export function ImageSlot({
  label,
  src,
  circle = false,
  priority = false,
  decorative = false,
  sizes = "(max-width: 860px) 100vw, 50vw",
}: {
  /** Beskrivning för skärmläsare/alt-text, t.ex. "Kolasnittar — närbild". */
  label: string;
  /** Sökväg till riktig bild (frivillig). Trasig/saknad bild faller tillbaka till platshållaren. */
  src?: string;
  circle?: boolean;
  /** true för sidans LCP-bild (hero): eager + hög fetch-prioritet. Övriga lazy-laddas. */
  priority?: boolean;
  /** Bilden upprepar synlig text (t.ex. råvaruruta med namn under) — tom alt för skärmläsare. */
  decorative?: boolean;
  /** Hint till bildoptimeringen om hur bred bilden visas (CSS-bredd). */
  sizes?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = !!src && !broken;

  if (showImage) {
    return (
      // fill kräver en positionerad förälder — wrappern fyller containern.
      <span style={{ position: "relative", display: "block", width: "100%", height: "100%", minHeight: "inherit" }}>
        <Image
          src={src}
          alt={decorative ? "" : label}
          fill
          sizes={sizes}
          priority={priority}
          onError={() => setBroken(true)}
          style={{ objectFit: "cover", borderRadius: circle ? "50%" : undefined }}
        />
      </span>
    );
  }

  return (
    <div
      className="img-slot"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      style={circle ? { borderRadius: "50%" } : undefined}
    >
      <span className="img-slot-mark" aria-hidden="true">
        S
      </span>
    </div>
  );
}

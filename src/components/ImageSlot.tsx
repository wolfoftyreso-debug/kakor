"use client";

// Bildyta. Om en riktig bild (t.ex. produktens bildreferens i /public) finns
// visas den; annars — eller om filen saknas — en varsam platshållare i
// varumärkets färger tills foton enligt designpaketets shot list levereras.
// Inga AI-genererade eller lånade foton används.

import { useEffect, useRef, useState } from "react";

export function ImageSlot({
  label,
  src,
  circle = false,
}: {
  /** Beskrivning för skärmläsare/alt-text, t.ex. "Kolasnittar — närbild". */
  label: string;
  /** Sökväg till riktig bild (frivillig). Trasig/saknad bild faller tillbaka till platshållaren. */
  src?: string;
  circle?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Bilden kan fela INNAN React hydrerat (SSR) — då missas onError.
  // Kontrollera därför även efter mount om bilden faktiskt laddades.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, [src]);

  const showImage = !!src && !broken;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        src={src}
        alt={label}
        onError={() => setBroken(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          borderRadius: circle ? "50%" : undefined,
        }}
      />
    );
  }

  return (
    <div
      className="img-slot"
      role="img"
      aria-label={label}
      style={circle ? { borderRadius: "50%" } : undefined}
    >
      <span className="img-slot-mark" aria-hidden="true">
        S
      </span>
    </div>
  );
}

import { IconInvoice, IconLeaf, IconTruck } from "@/components/Icons";
import { getDeliveryDaysLabel } from "@/lib/products";

// Tre korta, sanna löften under hero/CTA. Leveransdagarna hämtas ur
// områdenas inställningar (data) — aldrig hårdkodade i text.
export async function TrustStrip({ band = false }: { band?: boolean }) {
  const deliveryDays = await getDeliveryDaysLabel();
  const items = [
    { icon: <IconInvoice />, text: "Betalning mot faktura" },
    {
      icon: <IconTruck />,
      text: deliveryDays ? `Leverans ${deliveryDays} i södra Stockholm` : "Fasta leveransdagar i södra Stockholm",
    },
    { icon: <IconLeaf />, text: "Riktigt smör, inga genvägar" },
  ];
  return (
    <ul className={`trust-strip${band ? " trust-strip--band" : ""}`} aria-label="Så handlar ni hos oss">
      {items.map((i) => (
        <li key={i.text}>
          {i.icon}
          <span>{i.text}</span>
        </li>
      ))}
    </ul>
  );
}

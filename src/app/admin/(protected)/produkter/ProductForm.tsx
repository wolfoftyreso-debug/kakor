"use client";

import { useActionState } from "react";
import { saveProduct } from "@/app/admin/actions";

export interface ProductFormValues {
  name: string;
  slug: string;
  description: string;
  priceKr: string;
  vatRateBp: number;
  unit: string; // "kg" | "paket"
  packageWeightGrams: number;
  weightOptions: string;
  ingredients: string;
  allergens: string;
  imageRef: string;
  badge: string;
  sortOrder: number;
  active: boolean;
}

export function ProductForm({
  productId,
  initial,
}: {
  productId: string | null;
  initial: ProductFormValues;
}) {
  const action = saveProduct.bind(null, productId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="form-grid" style={{ maxWidth: 720 }}>
      <label className="field">
        Namn
        <input name="name" defaultValue={initial.name} required maxLength={80} />
      </label>
      <label className="field">
        Slug (URL)
        <input name="slug" defaultValue={initial.slug} required pattern="[a-z0-9-]{2,60}" />
      </label>
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        Beskrivning
        <textarea name="description" defaultValue={initial.description} rows={2} required style={{ resize: "vertical" }} />
      </label>
      <label className="field">
        Pris per enhet (kr)
        <input name="priceKr" type="number" step="0.01" min="0" defaultValue={initial.priceKr} required />
      </label>
      <label className="field">
        Momssats
        <select name="vatRateBp" defaultValue={String(initial.vatRateBp)}>
          <option value="1200">12 % (livsmedel)</option>
          <option value="600">6 %</option>
          <option value="2500">25 %</option>
        </select>
      </label>
      <label className="field">
        Säljs per
        <select name="unit" defaultValue={initial.unit}>
          <option value="kg">kilo (lösvikt)</option>
          <option value="paket">paket (styckvara)</option>
        </select>
      </label>
      <label className="field">
        Paketvikt (gram — endast styckvaror, 0 för lösvikt)
        <input
          name="packageWeightGrams"
          type="number"
          min="0"
          max="100000"
          defaultValue={initial.packageWeightGrams}
        />
      </label>
      <label className="field">
        Förvalt antal i antalsväljaren (första värdet används som start)
        <input name="weightOptions" defaultValue={initial.weightOptions} required placeholder="1,2,3" />
      </label>
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        Ingredienser
        <textarea name="ingredients" defaultValue={initial.ingredients} rows={2} style={{ resize: "vertical" }} />
      </label>
      <label className="field" style={{ gridColumn: "1 / -1" }}>
        Allergener
        <input name="allergens" defaultValue={initial.allergens} placeholder="Innehåller vete, smör (mjölk)." />
      </label>
      <label className="field">
        Bildreferens (sökväg i /public)
        <input name="imageRef" defaultValue={initial.imageRef} placeholder="/images/kolasnittar.jpg" />
      </label>
      <label className="field">
        Etikett på produktkortet (t.ex. Bästsäljare — tom för ingen)
        <input name="badge" defaultValue={initial.badge} maxLength={30} placeholder="Bästsäljare" />
      </label>
      <label className="field">
        Sorteringsordning
        <input name="sortOrder" type="number" min="0" max="999" defaultValue={initial.sortOrder} />
      </label>
      <label className="checkbox-label" style={{ gridColumn: "1 / -1" }}>
        <input type="checkbox" name="active" defaultChecked={initial.active} />
        Aktiv (visas och kan beställas)
      </label>
      {state?.error && (
        <div role="alert" className="error-text" style={{ gridColumn: "1 / -1" }}>
          {state.error}
        </div>
      )}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12 }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Sparar…" : "Spara produkt"}
        </button>
      </div>
    </form>
  );
}

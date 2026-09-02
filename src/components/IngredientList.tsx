import { highlightAllergens } from "@/lib/allergens";

// Ingrediensförteckning med allergener i fetstil (1169/2011 art. 21).
export function IngredientList({ ingredients, style }: { ingredients: string; style?: React.CSSProperties }) {
  return (
    <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.65, ...style }}>
      {highlightAllergens(ingredients).map((seg, i) =>
        seg.allergen ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>
      )}
    </p>
  );
}

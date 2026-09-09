const CITY_ROUTE = ["Tyresö", "Nacka", "Haninge", "Huddinge"];

/** Körordning: områdets sortOrder, annars Tyresö→Nacka→Haninge→Huddinge, sedan postnummer. */
export function sortStopsByRoute<
  T extends { areaSortOrder?: number; deliveryCity: string; deliveryPostalCode: string; companyName: string },
>(stops: T[]): T[] {
  return [...stops].sort((a, b) => {
    const sa = a.areaSortOrder ?? (CITY_ROUTE.indexOf(a.deliveryCity) < 0 ? 99 : CITY_ROUTE.indexOf(a.deliveryCity));
    const sb = b.areaSortOrder ?? (CITY_ROUTE.indexOf(b.deliveryCity) < 0 ? 99 : CITY_ROUTE.indexOf(b.deliveryCity));
    return sa - sb || a.deliveryPostalCode.localeCompare(b.deliveryPostalCode) || a.companyName.localeCompare(b.companyName, "sv");
  });
}

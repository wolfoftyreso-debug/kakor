import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";

// Sessionskontroll per SIDA, inte bara i layouten: layouts re-renderas inte
// vid klientnavigering och kan kringgås med riktade RSC-förfrågningar, så
// varje skyddad sida verifierar själv. Mutationer verifierar dessutom igen
// i sina server actions.
export async function requireAdminPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

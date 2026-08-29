import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";

const SESSION_COOKIE = "sb_admin_session";
const SESSION_TTL_HOURS = 12;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function loginAdmin(email: string, password: string): Promise<boolean> {
  const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Verifiera alltid mot en hash så att svarstiden inte avslöjar om kontot finns.
  const dummy = "00:00";
  const ok = await verifyPassword(password, user?.passwordHash ?? dummy);
  if (!user || !ok) return false;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000);
  await prisma.adminSession.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
}

/** Returnerar inloggad admin eller null. Rensar utgångna sessioner opportunistiskt. */
export async function getAdmin(): Promise<AdminIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

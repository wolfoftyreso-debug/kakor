"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label className="field">
        E-post
        <input type="email" name="email" autoComplete="username" required />
      </label>
      <label className="field">
        Lösenord
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {state?.error && (
        <div role="alert" className="error-text">
          {state.error}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}

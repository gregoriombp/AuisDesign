"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuCard } from "@/components/ui/AuCard";
import { AuButton } from "@/components/ui/AuButton";
import { AuInput, AuField } from "@/components/ui/AuInput";

export default function AuisLogin() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setIsDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/auis"), 350);
  };

  return (
    <main
      className={`auis-login-page${isDark ? " dark" : ""}`}
      data-theme={isDark ? "dark" : "light"}
    >
      <div
        className="auis-login-wordmark"
        role="img"
        aria-label="Auis"
      />

      <div className="auis-login-content">
        <header className="auis-login-header">
          <p className="au-eyebrow">Product Builder Platform</p>
          <h1 className="auis-login-title">Sign in to the platform</h1>
          <p className="auis-login-subtitle">
            Access your projects, page builder and design system.
          </p>
        </header>

        <AuCard className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AuField variant="framed" label="Email" htmlFor="email">
              <AuInput
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </AuField>

            <div className="flex flex-col gap-1.5">
              <AuField variant="framed" label="Password" htmlFor="password">
                <AuInput
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </AuField>
              <Link
                href="#"
                className="self-end text-xs text-(--fg-secondary) hover:text-(--fg-primary) no-underline"
              >
                Forgot password
              </Link>
            </div>

            <AuButton
              type="submit"
              variant="primary"
              iconRight={loading ? undefined : "arrow_forward"}
              disabled={loading}
              className="mt-2"
            >
              {loading ? "Signing in…" : "Sign in"}
            </AuButton>
          </form>
        </AuCard>

        <p className="auis-login-foot">
          First time here?{" "}
          <Link href="/auis/welcome" className="auis-login-foot-link">
            Set up your brand
          </Link>
        </p>
      </div>
    </main>
  );
}

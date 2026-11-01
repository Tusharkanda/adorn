"use client";

import { useAuth } from "@/lib/useAuth";
import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  return <Dashboard email={session.user.email ?? ""} />;
}

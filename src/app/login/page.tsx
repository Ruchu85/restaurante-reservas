import { LoginForm } from "@/components/auth/LoginForm";
import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Acceso — Restaurante Demo" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect(params.redirectTo ?? "/dashboard");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold hover:opacity-80">
            <UtensilsCrossed className="h-5 w-5" />
            Restaurante Demo
          </Link>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold">Acceso interno</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Panel para administradores y personal
            </p>
          </div>
          <LoginForm redirectTo={params.redirectTo} />
        </div>
      </div>
    </div>
  );
}

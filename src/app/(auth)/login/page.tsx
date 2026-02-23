import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/env";

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user && isEmailAllowed(data.user.email)) {
    redirect("/app/prompts");
  }

  const params = await searchParams;
  const initialError = params.error === "forbidden" ? "許可されていないアカウントです" : "";

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <LoginForm initialError={initialError} />
    </main>
  );
};

export default LoginPage;

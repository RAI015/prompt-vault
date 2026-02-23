"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/error-text";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { emailPasswordSchema } from "@/schemas/auth";
import { createClient } from "@/lib/supabase/client";

export const LoginForm = ({ initialError }: { initialError?: string }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState(initialError ?? "");

  const onSubmitEmailPassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");

    const parsed = emailPasswordSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email") {
          nextErrors.email = issue.message;
        }
        if (issue.path[0] === "password") {
          nextErrors.password = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword(parsed.data);

      if (error) {
        setFormError("ログインに失敗しました。メールアドレスかパスワードを確認してください。");
        return;
      }

      router.push("/app/prompts");
      router.refresh();
    });
  };

  const onGithubLogin = () => {
    setFormError("");
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setFormError("GitHubログインの開始に失敗しました");
      }
    });
  };

  return (
    <div className="w-full max-w-md rounded-lg border bg-card p-8">
      <h1 className="mb-6 text-2xl font-bold">Prompt Vault ログイン</h1>

      {formError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmitEmailPassword}>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            メールアドレス
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <ErrorText>{fieldErrors.email}</ErrorText>
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            パスワード
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <ErrorText>{fieldErrors.password}</ErrorText>
        </div>

        <Button className="w-full" type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          <span className="ml-2">メールでログイン</span>
        </Button>
      </form>

      <div className="my-6 h-px bg-border" />

      <Button className="w-full" variant="outline" type="button" onClick={onGithubLogin} disabled={isPending}>
        GitHubでログイン
      </Button>
    </div>
  );
};

import { redirect } from "next/navigation";

import { PromptVaultClient } from "@/components/prompts/prompt-vault-client";
import { log } from "@/lib/log";
import { syncCurrentAppUser } from "@/server/services/auth-service";
import { listMyPrompts } from "@/server/services/prompt-service";

const PromptsPage = async () => {
  const userResult = await syncCurrentAppUser();
  if (userResult.error) {
    log("warn", "prompts page user sync failed", {
      code: userResult.error.code,
      message: userResult.error.message,
    });
    if (userResult.error.code === "UNAUTHORIZED" || userResult.error.code === "FORBIDDEN") {
      redirect("/login");
    }
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          ユーザー情報の同期に失敗しました: {userResult.error.message}
        </div>
      </main>
    );
  }

  const promptsResult = await listMyPrompts();
  if (promptsResult.error) {
    log("error", "prompts page list failed", {
      code: promptsResult.error.code,
      message: promptsResult.error.message,
    });
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          プロンプトの取得に失敗しました: {promptsResult.error.message}
        </div>
      </main>
    );
  }

  return <PromptVaultClient initialPrompts={promptsResult.data} />;
};

export default PromptsPage;

import { redirect } from "next/navigation";

import { PromptVaultClient } from "@/components/prompts/prompt-vault-client";
import { listMyPrompts } from "@/server/services/prompt-service";
import { syncCurrentAppUser } from "@/server/services/auth-service";

const PromptsPage = async () => {
  const userResult = await syncCurrentAppUser();
  if (userResult.error) {
    redirect("/login");
  }

  const promptsResult = await listMyPrompts();
  if (promptsResult.error) {
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

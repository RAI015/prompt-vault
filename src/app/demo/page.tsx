import { DEMO_PROMPTS } from "@/components/prompts/demo-prompts";
import { PromptVaultClient } from "@/components/prompts/prompt-vault-client";
import { getFrontendVersion } from "@/lib/frontend-version";

export default function DemoPage() {
  return (
    <PromptVaultClient
      initialPrompts={DEMO_PROMPTS}
      mode="demo"
      initialFrontendVersion={getFrontendVersion()}
    />
  );
}

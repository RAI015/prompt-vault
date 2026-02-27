import { DEMO_PROMPTS } from "@/components/prompts/demo-prompts";
import { PromptVaultClient } from "@/components/prompts/prompt-vault-client";

export default function DemoPage() {
  return <PromptVaultClient initialPrompts={DEMO_PROMPTS} mode="demo" />;
}

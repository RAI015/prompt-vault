import { PromptVaultClient } from "@/components/prompts/prompt-vault-client";
import { DEMO_PROMPTS } from "@/components/prompts/demo-prompts";

export default function DemoPage() {
  return <PromptVaultClient initialPrompts={DEMO_PROMPTS} mode="demo" />;
}

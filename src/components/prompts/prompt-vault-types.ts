import type { Prompt } from "@prisma/client";

export type PromptInputState = {
  title: string;
  body: string;
  tagsCsv: string;
};

export type ToastState = {
  message: string;
  variant: "success" | "error";
};

export type PromptLike = Pick<Prompt, "id" | "title" | "tags" | "body" | "pinnedAt">;

export type PromptVaultMode = "app" | "demo";

export type CopyHistoryEntry = {
  createdAt: string;
  title: string;
  values: Record<string, string>;
};

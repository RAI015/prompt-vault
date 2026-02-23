import { z } from "zod";

export const tagSchema = z
  .string()
  .trim()
  .min(1, "タグは空にできません")
  .max(30, "タグは30文字以内で入力してください");

export const promptSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "タイトルは必須です")
    .max(100, "タイトルは100文字以内で入力してください"),
  body: z
    .string()
    .trim()
    .min(1, "本文は必須です")
    .max(10000, "本文は10000文字以内で入力してください"),
  tags: z.array(tagSchema).max(10, "タグは10個以内で入力してください"),
});

export type PromptInput = z.infer<typeof promptSchema>;

export const parseTagCsv = (value: string): string[] => {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

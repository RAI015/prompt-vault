import { z } from "zod";

export const emailPasswordSchema = z.object({
  email: z.string().trim().email("メールアドレスの形式が不正です"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export type EmailPasswordInput = z.infer<typeof emailPasswordSchema>;

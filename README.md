# Prompt Vault MVP

Next.js (App Router) + Supabase Auth + Prisma で作る、個人用の Prompt Vault です。

## 1. セットアップ手順

```bash
pnpm install
cp .env.example .env.local
cp .env.test.example .env.test.local
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

アプリ起動後: `http://localhost:3000`

## 2. 環境変数の設定

`.env.local`（git管理しない）

```bash
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ALLOW_EMAILS=you@example.com,test@example.com
```

`.env.test.local`（git管理しない）

```bash
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=your-test-password
```

- `ALLOW_EMAILS`: カンマ区切りの許可メール一覧。ログイン直後にallowlist判定し、未許可は即サインアウトします。
- 本番環境では `ALLOW_EMAILS` 未設定時に起動エラー（fail fast）になります。

## 3. Supabase設定手順

1. Supabaseで新規プロジェクトを作成
2. SQL Editor / DB設定から接続文字列を取得し `DATABASE_URL` に設定
3. Authentication > Providers で `GitHub` を有効化
4. Authentication > Providers で `Email` を有効化（E2E用）
5. Authentication > URL Configuration で Redirect URL を設定
6. Authentication > Users でE2E用テストユーザーを作成
7. テストユーザーのemailを `ALLOW_EMAILS` に含める

## 4. Docker起動手順

通常開発は `pnpm dev` を推奨。Dockerは将来のローカルSupabase CLI連携を見据えた準備です。

```bash
docker compose up --build
```

- `docker-compose.yml` は現在 `app` のみ
- 将来、Supabase CLIを使う際は `supabase start` を実行し、`docker-compose.yml` にSupabase関連サービスを追加

## 5. gitleaks運用

### 導入

```bash
pre-commit install
```

### 手動実行

```bash
pnpm gitleaks
```

### CI

- `.github/workflows/gitleaks.yml` で push / PR 時にgitleaksを実行

### 検知されたときの対処

1. 検知箇所から秘密情報を削除
2. すでにコミット済みの場合は履歴からも削除（必要ならローテーション）
3. 正当なダミー値のみ `.gitleaks.toml` に最小範囲でallowlist追加

## 6. ⚠️ TODO（技術的負債）

### RLS未対応

現在、Supabase PostgresのRLSは未使用です。代わりにアプリ側で `ownerId` チェックを強制しています。

注意点: PrismaのDB直接接続では、リクエスト単位JWTがDBへ伝播せず、`auth.uid()`ベースのRLSをそのまま適用しづらいことが多いです。

将来RLS導入時は、以下からDBアクセス方式を再選定してください。

- Supabase client（PostgREST）へ寄せる
- Supabase Edge Functionsへ寄せる
- PrismaにJWT伝播機構を追加（複雑）

参考SQL（テーブル名は実マイグレーション結果に合わせる）:

```sql
ALTER TABLE "Prompt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON "Prompt"
  USING (
    "ownerId" = (
      SELECT id FROM "AppUser"
      WHERE "authSubject" = auth.uid()::text
    )
  );
```

### GitHub OAuth E2E未対応

GitHub OAuthは外部UI自動化が不安定なため、E2Eはメール/パスワード認証で実施しています。

将来対応方針:

- Playwright `storageState` でOAuth後セッションを事前取得
- OAuth自体は手動確認 + セッション再利用でE2E安定化

## 主要コマンド

```bash
pnpm dev
pnpm build
pnpm start
pnpm biome:check
pnpm prisma:migrate
pnpm test:e2e
pnpm gitleaks
```

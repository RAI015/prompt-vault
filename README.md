# Prompt Vault MVP

個人用の Prompt Vault
> 注: 未ログインでも「デモを見る（閲覧のみ）」で閲覧用デモを確認可能（編集・保存は不可）。

[![quality](https://github.com/RAI015/prompt-vault/actions/workflows/quality.yml/badge.svg)](https://github.com/RAI015/prompt-vault/actions/workflows/quality.yml)
[![gitleaks](https://github.com/RAI015/prompt-vault/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/RAI015/prompt-vault/actions/workflows/gitleaks.yml)
[![e2e](https://github.com/RAI015/prompt-vault/actions/workflows/e2e.yml/badge.svg)](https://github.com/RAI015/prompt-vault/actions/workflows/e2e.yml)

## 使用技術スタック

- フロントエンド: Next.js（App Router）, React, TypeScript
- UI: Tailwind CSS, shadcn-ui
- 認証/DB: Supabase Auth, Supabase Postgres
- ORM: Prisma
- バリデーション: Zod
- テスト: Playwright
- Lint/Format: Biome
- パッケージ管理: pnpm
- インフラ: Vercel

## 動作要件

- Node.js: 22系（CIも `node-version: 22`）
- pnpm: 10系

## 品質ゲート

ローカルでの推奨チェック:

```bash
pnpm biome:check
pnpm build
pnpm test:e2e
pnpm gitleaks
```

CI（GitHub Actions）:

- `quality`: push / pull_request で `pnpm prisma:generate` / `pnpm biome:check` / `pnpm build` を実行（build用のダミー環境変数を設定、`.github/workflows/quality.yml`）
- `gitleaks`: push / pull_request で常時実行（`.github/workflows/gitleaks.yml`）
- `e2e`: push / pull_request / manual 実行。必要Secretsが揃っている場合のみ実行（`.github/workflows/e2e.yml`）
- `cleanup-ci-db`: manual / 毎週月曜 03:00 UTC（日本時間: 毎週月曜 12:00）に実行。CI用DBのテストデータを削除（`.github/workflows/cleanup-ci-db.yml`）

`cleanup-ci-db` に必要な Secrets:

- `CI_CLEANUP_DATABASE_URL`（CI用Supabase DBの接続URL）
- `CI_DATABASE_PROJECT_REF`（CI用Supabaseのproject ref）
- `CI_CLEANUP_ALLOW_EMAILS`（削除対象メール一覧。カンマ区切り）

## セキュリティと制約

保証すること:

- 認証は Supabase Auth を使用（GitHub OAuth / メール・パスワード）
- `ALLOW_EMAILS` で許可メールのみ利用可能（未許可はログイン直後にサインアウト）
- アプリ層で `ownerId` チェックを行い、他ユーザーの Prompt を操作できないように制御
- `gitleaks` で秘密情報の漏えいを CI で検知

未対応・制約（現状）:

- Supabase Postgres の RLS は未適用（DB層での最終防御は未実装）
- E2E はメール・パスワード認証中心で、GitHub OAuth の自動E2Eは未対応

リスク:

- 現状はアプリケーション実装に依存したアクセス制御のため、将来的には RLS 導入で DB 側の防御を追加する必要がある
- `ALLOW_EMAILS` の運用ミス（設定漏れ/更新漏れ）は、意図しないアクセス許可につながる可能性がある

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

## キーボードショートカット

- `/`: 検索欄にフォーカス
- `Enter`（検索欄）: 選択中（検索結果内）または先頭テンプレを開き、検索欄は `blur`
- `⌥C`: 生成結果をコピー（`input` / `textarea` / `contenteditable` フォーカス中は発火しない）

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

- `ALLOW_EMAILS`: カンマ区切りの許可メール一覧。ログイン直後にallowlist判定し、未許可は即サインアウト。
- 本番環境では `ALLOW_EMAILS` 未設定時に起動エラー（fail fast）となる。

## 3. Supabase設定手順

1. Supabaseで新規プロジェクトを作成
2. SQL Editor / DB設定から接続文字列を取得し `DATABASE_URL` に設定
3. Authentication > Providers で `GitHub` を有効化
4. Authentication > Providers で `Email` を有効化（E2E用）
5. Authentication > URL Configuration で Redirect URL を設定
6. Authentication > Users でE2E用テストユーザーを作成
7. テストユーザーのemailを `ALLOW_EMAILS` に含める

## 4. Docker起動手順

通常開発は `pnpm dev` を推奨。Dockerは将来のローカルSupabase CLI連携を見据えた準備。

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

現在、Supabase PostgresのRLSは未使用。代わりにアプリ側で `ownerId` チェックを強制。

注意点: PrismaのDB直接接続では、リクエスト単位JWTがDBへ伝播せず、`auth.uid()`ベースのRLSをそのまま適用しづらいことが多い。

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

GitHub OAuthは外部UI自動化が不安定なため、E2Eはメール/パスワード認証で実施。
また、クリップボード確認は環境差分で不安定になりやすいため、E2Eでは `navigator.clipboard.writeText` をスタブしてUI挙動を検証。

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

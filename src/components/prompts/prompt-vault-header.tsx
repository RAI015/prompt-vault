import iconSrc from "@/app/icon.png";
import { Button, buttonVariants } from "@/components/ui/button";
import { PV_SELECTORS } from "@/constants/ui-selectors";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

type PromptVaultHeaderProps = {
  homeHref: "/demo" | "/app/prompts";
  isDemo: boolean;
  hasUpdateAvailable: boolean;
  logout: () => void;
  isPending: boolean;
};

export const PromptVaultHeader = ({
  homeHref,
  isDemo,
  hasUpdateAvailable,
  logout,
  isPending,
}: PromptVaultHeaderProps) => {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <Link href={homeHref} className="flex items-center gap-2 font-semibold">
        <Image
          src={iconSrc}
          alt=""
          width={20}
          height={20}
          className="rounded-sm border-[0.5px] border-white/50"
        />
        <span>Prompt Vault</span>
      </Link>
      {isDemo && (
        <span className="rounded-md border px-2 py-0.5 text-muted-foreground">
          DEMO（閲覧のみ）
        </span>
      )}
      <div className="flex items-center gap-2">
        <div
          data-pv={PV_SELECTORS.versionBanner}
          className={cn(
            "items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-900 shadow-sm dark:text-amber-200",
            hasUpdateAvailable ? "flex" : "hidden",
          )}
        >
          <p>新しいバージョンがあります。</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
            data-pv={PV_SELECTORS.versionReloadButton}
          >
            更新する
          </Button>
        </div>
        {isDemo ? (
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            ログインして使う
          </Link>
        ) : (
          <Button variant="outline" onClick={logout} disabled={isPending}>
            ログアウト
          </Button>
        )}
      </div>
    </header>
  );
};

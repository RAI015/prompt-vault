import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PV_SELECTORS } from "@/constants/ui-selectors";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import type { ReactNode } from "react";

type PreviewTabContentProps = {
  activeRightTab: "preview" | "history";
  copyPlainText: () => Promise<void>;
  copyMarkdownText: () => Promise<void>;
  copyOriginalText: () => Promise<void>;
  renderedPreviewNodes: ReactNode[];
};

export const PreviewTabContent = ({
  activeRightTab,
  copyPlainText,
  copyMarkdownText,
  copyOriginalText,
  renderedPreviewNodes,
}: PreviewTabContentProps) => {
  return (
    <div
      id="preview-rendered-panel"
      className={cn(
        "mt-3 min-h-0 flex-1 flex-col gap-2",
        activeRightTab === "preview" ? "flex" : "hidden",
      )}
    >
      <div className="flex h-9 items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void copyPlainText();
          }}
          title="プロンプト本文のみをコピーします"
          data-pv={PV_SELECTORS.copyBodyButton}
        >
          <Copy className="mr-2 h-4 w-4" />
          本文コピー
          <kbd className="ml-2 rounded border px-1 text-[10px] leading-4 text-muted-foreground">
            ⌥C
          </kbd>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: "outline", size: "sm" })}
            data-pv={PV_SELECTORS.copyMenuButton}
          >
            …
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                void copyMarkdownText();
              }}
              data-pv={PV_SELECTORS.copyMarkdownButton}
            >
              Markdown整形コピー
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void copyOriginalText();
              }}
              data-pv={PV_SELECTORS.copyOriginalButton}
            >
              原文（テンプレ）コピー
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ScrollArea
        data-pv={PV_SELECTORS.renderedOutput}
        className="min-h-0 flex-1 whitespace-pre-wrap rounded-md bg-background/60 p-4"
      >
        {renderedPreviewNodes}
      </ScrollArea>
    </div>
  );
};

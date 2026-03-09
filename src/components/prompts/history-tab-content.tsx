import type { CopyHistoryEntry } from "@/components/prompts/prompt-vault-types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PV_SELECTORS } from "@/constants/ui-selectors";
import { cn } from "@/lib/utils";
import { History, Trash2 } from "lucide-react";

type HistoryTabContentProps = {
  activeRightTab: "preview" | "history";
  copyHistory: CopyHistoryEntry | null;
  toAbsoluteDateLabel: (isoDate: string) => string;
  toRelativeDateLabel: (isoDate: string) => string;
  loadCopyHistory: () => void;
  clearCopyHistory: () => void;
  renderedHistoryBody: string;
};

export const HistoryTabContent = ({
  activeRightTab,
  copyHistory,
  toAbsoluteDateLabel,
  toRelativeDateLabel,
  loadCopyHistory,
  clearCopyHistory,
  renderedHistoryBody,
}: HistoryTabContentProps) => {
  return (
    <div
      id="history-panel"
      data-pv={PV_SELECTORS.historyPanel}
      className={cn(
        "mt-3 min-h-0 flex-1 flex-col gap-2",
        activeRightTab === "history" ? "flex" : "hidden",
      )}
    >
      {copyHistory ? (
        <>
          <div className="flex h-9 items-center justify-between gap-2">
            <p
              className="text-xs text-muted-foreground"
              title={toAbsoluteDateLabel(copyHistory.createdAt)}
              data-pv={PV_SELECTORS.historyCreatedAt}
            >
              保存日時: {toRelativeDateLabel(copyHistory.createdAt)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadCopyHistory}
                data-pv={PV_SELECTORS.historyLoadButton}
                disabled={!copyHistory}
              >
                <History className="mr-2 h-4 w-4" />
                ロード
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearCopyHistory}
                data-pv={PV_SELECTORS.historyClearButton}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                履歴クリア
              </Button>
            </div>
          </div>
          <ScrollArea
            data-pv={PV_SELECTORS.historyRenderedOutput}
            className="min-h-0 flex-1 whitespace-pre-wrap rounded-md bg-background/60 p-4"
          >
            {renderedHistoryBody}
          </ScrollArea>
          <p className="text-xs text-muted-foreground">※現在のテンプレに当てたプレビューです</p>
        </>
      ) : (
        <div className="rounded-md border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
          このプロンプトの履歴はまだありません。
        </div>
      )}
    </div>
  );
};

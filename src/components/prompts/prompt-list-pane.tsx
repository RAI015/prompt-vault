import type { PromptLike } from "@/components/prompts/prompt-vault-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PV_SELECTORS } from "@/constants/ui-selectors";
import { Pin, Plus, Search } from "lucide-react";
import type { RefObject } from "react";

type PromptListPaneProps = {
  isDemo: boolean;
  search: string;
  setSearch: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  switchToCreateMode: () => void;
  filteredPrompts: PromptLike[];
  selectedPromptId: string | null;
  isFormMode: boolean;
  selectPrompt: (prompt: PromptLike) => void;
  togglePin: (promptId: string) => void;
};

export const PromptListPane = ({
  isDemo,
  search,
  setSearch,
  searchInputRef,
  switchToCreateMode,
  filteredPrompts,
  selectedPromptId,
  isFormMode,
  selectPrompt,
  togglePin,
}: PromptListPaneProps) => {
  return (
    <aside
      className="flex min-h-0 flex-col overflow-hidden border-r"
      data-pv={PV_SELECTORS.leftPane}
    >
      <div className="space-y-3 p-3">
        {!isDemo && (
          <Button
            className="w-full"
            onClick={switchToCreateMode}
            data-pv={PV_SELECTORS.createButton}
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        )}
        <div className="space-y-1">
          <label htmlFor="prompt-search" className="text-xs font-medium text-muted-foreground">
            検索
          </label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="prompt-search"
              data-pv={PV_SELECTORS.searchInput}
              ref={searchInputRef}
              className="pl-8"
              placeholder="タイトル / タグで絞り込み"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (filteredPrompts.length === 0) {
                    return;
                  }
                  const selectedInResults = filteredPrompts.find(
                    (prompt) => prompt.id === selectedPromptId,
                  );
                  selectPrompt(selectedInResults ?? filteredPrompts[0]);
                  searchInputRef.current?.blur();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  searchInputRef.current?.blur();
                }
              }}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 pb-3">
        <div className="space-y-2">
          {filteredPrompts.map((prompt) => (
            <div
              key={prompt.id}
              data-pv={PV_SELECTORS.searchResultItem}
              className={`w-full rounded-md border-l-2 p-2 text-left ${
                selectedPromptId === prompt.id && !isFormMode
                  ? "border-transparent bg-accent"
                  : prompt.pinnedAt
                    ? "border-primary/40 bg-muted/30 hover:bg-muted"
                    : "border-transparent hover:bg-muted"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => selectPrompt(prompt)}
                >
                  <p className="line-clamp-1 text-sm font-medium">{prompt.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {prompt.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </button>
                <button
                  type="button"
                  data-pv={PV_SELECTORS.searchResultPinButton}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-accent"
                  aria-label={prompt.pinnedAt ? "ピン解除" : "ピン留め"}
                  title={prompt.pinnedAt ? "ピン解除" : "ピン留め"}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    togglePin(prompt.id);
                  }}
                >
                  <Pin
                    className={`h-4 w-4 ${
                      prompt.pinnedAt ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
};

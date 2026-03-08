import { getPlaceholderFieldSchema } from "@/components/prompts/placeholder-field-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PV_SELECTORS,
  getPlaceholderInputSelector,
  getPlaceholderLogActionSelector,
  getPlaceholderLogLineCountSelector,
} from "@/constants/ui-selectors";
import type { Dispatch, SetStateAction } from "react";
import {
  LOG_TRIM_LINE_COUNT,
  SERVICE_OTHER_VALUE,
  SERVICE_PLACEHOLDER_KEY,
  isLogsPlaceholder,
  isLongTextPlaceholder,
  splitLines,
  toHeadLines,
  toHeadTailLines,
  toTailLines,
} from "./prompt-vault-utils";

export type PromptPlaceholderFieldProps = {
  placeholderKey: string;
  placeholderValues: Record<string, string>;
  placeholderUndoValues: Record<string, string>;
  serviceInputMode: "preset" | "custom";
  canFillPlaceholderExamples: boolean;
  setActivePlaceholderKey: (key: string | null) => void;
  setPlaceholderValues: Dispatch<SetStateAction<Record<string, string>>>;
  setServiceInputMode: Dispatch<SetStateAction<"preset" | "custom">>;
  fillPlaceholderExamples: () => void;
  applyErrorLogsTransform: (key: string, transform: (value: string) => string) => void;
  restoreErrorLogsValue: (key: string) => void;
};

export const PromptPlaceholderField = ({
  placeholderKey,
  placeholderValues,
  placeholderUndoValues,
  serviceInputMode,
  canFillPlaceholderExamples,
  setActivePlaceholderKey,
  setPlaceholderValues,
  setServiceInputMode,
  fillPlaceholderExamples,
  applyErrorLogsTransform,
  restoreErrorLogsValue,
}: PromptPlaceholderFieldProps) => {
  const schema = getPlaceholderFieldSchema(placeholderKey);
  const isLongText = !schema && isLongTextPlaceholder(placeholderKey);
  const label = schema?.label ?? `{{${placeholderKey}}}`;
  const placeholderText = schema?.placeholder ?? (isLongText ? "複数行の入力に対応" : "値を入力");

  if (schema?.type === "select") {
    if (placeholderKey === SERVICE_PLACEHOLDER_KEY) {
      const presetOptions = schema.options.filter((option) => option !== SERVICE_OTHER_VALUE);
      const serviceValue = placeholderValues[placeholderKey] ?? "";
      const selectValue = presetOptions.includes(serviceValue) ? serviceValue : "";

      if (serviceInputMode === "custom") {
        return (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor={`placeholder-${placeholderKey}`}>
              {label}
            </label>
            <div className="space-y-2">
              <Input
                id={`placeholder-${placeholderKey}`}
                data-pv={getPlaceholderInputSelector(placeholderKey)}
                placeholder="サービス名を入力"
                value={serviceValue}
                onFocus={() => setActivePlaceholderKey(placeholderKey)}
                onBlur={() => setActivePlaceholderKey(null)}
                onChange={(event) =>
                  setPlaceholderValues((prev) => ({
                    ...prev,
                    [placeholderKey]: event.target.value,
                  }))
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setServiceInputMode("preset");
                  setPlaceholderValues((prev) => ({
                    ...prev,
                    [placeholderKey]: "",
                  }));
                }}
              >
                選択に戻る
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`placeholder-${placeholderKey}`}>
            {label}
          </label>
          <Select
            value={selectValue}
            onOpenChange={(open) => setActivePlaceholderKey(open ? placeholderKey : null)}
            onValueChange={(value) => {
              if (value === SERVICE_OTHER_VALUE) {
                setServiceInputMode("custom");
                setPlaceholderValues((prev) => ({
                  ...prev,
                  [placeholderKey]: "",
                }));
                return;
              }

              setServiceInputMode("preset");
              setPlaceholderValues((prev) => ({
                ...prev,
                [placeholderKey]: value,
              }));
            }}
          >
            <SelectTrigger
              id={`placeholder-${placeholderKey}`}
              data-pv={getPlaceholderInputSelector(placeholderKey)}
            >
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SERVICE_OTHER_VALUE}>other（その他）</SelectItem>
              {presetOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={`placeholder-${placeholderKey}`}>
          {label}
        </label>
        <Select
          value={placeholderValues[placeholderKey] ?? ""}
          onOpenChange={(open) => setActivePlaceholderKey(open ? placeholderKey : null)}
          onValueChange={(value) =>
            setPlaceholderValues((prev) => ({
              ...prev,
              [placeholderKey]: value,
            }))
          }
        >
          <SelectTrigger
            id={`placeholder-${placeholderKey}`}
            data-pv={getPlaceholderInputSelector(placeholderKey)}
          >
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {schema.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={`placeholder-${placeholderKey}`}>
        {label}
      </label>
      {isLongText || schema?.type === "longText" ? (
        <div className="space-y-2">
          <Textarea
            id={`placeholder-${placeholderKey}`}
            data-pv={getPlaceholderInputSelector(placeholderKey)}
            rows={6}
            className="resize-y font-mono"
            placeholder={placeholderText}
            value={placeholderValues[placeholderKey] ?? ""}
            onFocus={() => setActivePlaceholderKey(placeholderKey)}
            onBlur={() => setActivePlaceholderKey(null)}
            onChange={(event) =>
              setPlaceholderValues((prev) => ({
                ...prev,
                [placeholderKey]: event.target.value,
              }))
            }
          />
          {isLogsPlaceholder(placeholderKey) ? (
            <div className="space-y-2">
              <p
                className="text-xs text-muted-foreground"
                data-pv={getPlaceholderLogLineCountSelector(placeholderKey)}
              >
                行数: {splitLines(placeholderValues[placeholderKey] ?? "").length}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillPlaceholderExamples}
                  disabled={!canFillPlaceholderExamples}
                  title="空欄のうち、サンプルが定義されている項目だけ埋めます"
                  data-pv={PV_SELECTORS.fillPlaceholderExamplesButton}
                >
                  空欄にサンプル
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-pv={getPlaceholderLogActionSelector(placeholderKey, "head")}
                  title={`先頭から${LOG_TRIM_LINE_COUNT}行だけ残します`}
                  onClick={() =>
                    applyErrorLogsTransform(placeholderKey, (value) =>
                      toHeadLines(value, LOG_TRIM_LINE_COUNT),
                    )
                  }
                >
                  先頭{LOG_TRIM_LINE_COUNT}行
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-pv={getPlaceholderLogActionSelector(placeholderKey, "tail")}
                  title={`末尾から${LOG_TRIM_LINE_COUNT}行だけ残します`}
                  onClick={() =>
                    applyErrorLogsTransform(placeholderKey, (value) =>
                      toTailLines(value, LOG_TRIM_LINE_COUNT),
                    )
                  }
                >
                  末尾{LOG_TRIM_LINE_COUNT}行
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-pv={getPlaceholderLogActionSelector(placeholderKey, "head-tail")}
                  title={`先頭${LOG_TRIM_LINE_COUNT}行と末尾${LOG_TRIM_LINE_COUNT}行だけ残します`}
                  onClick={() =>
                    applyErrorLogsTransform(placeholderKey, (value) =>
                      toHeadTailLines(value, LOG_TRIM_LINE_COUNT),
                    )
                  }
                >
                  先頭+末尾
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-pv={getPlaceholderLogActionSelector(placeholderKey, "undo")}
                  title="直前の短縮を取り消します"
                  onClick={() => restoreErrorLogsValue(placeholderKey)}
                  disabled={placeholderUndoValues[placeholderKey] === undefined}
                >
                  元に戻す
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <Input
          id={`placeholder-${placeholderKey}`}
          data-pv={getPlaceholderInputSelector(placeholderKey)}
          placeholder={placeholderText}
          value={placeholderValues[placeholderKey] ?? ""}
          onFocus={() => setActivePlaceholderKey(placeholderKey)}
          onBlur={() => setActivePlaceholderKey(null)}
          onChange={(event) =>
            setPlaceholderValues((prev) => ({
              ...prev,
              [placeholderKey]: event.target.value,
            }))
          }
        />
      )}
    </div>
  );
};

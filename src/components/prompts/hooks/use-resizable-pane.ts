import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useResizablePane = ({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}) => {
  const [width, setWidth] = useState<number>(defaultWidth);
  const widthRef = useRef<number>(defaultWidth);
  const dragStateRef = useRef<{
    isDragging: boolean;
    pointerId: number | null;
    startX: number;
    startWidth: number;
  }>({
    isDragging: false,
    pointerId: null,
    startX: 0,
    startWidth: defaultWidth,
  });

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      const nextWidth = clamp(parsed, minWidth, maxWidth);
      widthRef.current = nextWidth;
      setWidth(nextWidth);
    }
  }, [maxWidth, minWidth, storageKey]);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const finishDragging = useCallback(
    (finalWidth?: number) => {
      if (!dragStateRef.current.isDragging) return;
      dragStateRef.current.isDragging = false;
      dragStateRef.current.pointerId = null;

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const widthToSave = clamp(finalWidth ?? widthRef.current, minWidth, maxWidth);
      widthRef.current = widthToSave;
      setWidth(widthToSave);
      localStorage.setItem(storageKey, String(widthToSave));
    },
    [maxWidth, minWidth, storageKey],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = {
      isDragging: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: widthRef.current,
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current.isDragging) return;
      if (dragStateRef.current.pointerId !== event.pointerId) return;
      const delta = event.clientX - dragStateRef.current.startX;
      const nextWidth = clamp(dragStateRef.current.startWidth + delta, minWidth, maxWidth);
      widthRef.current = nextWidth;
      setWidth(nextWidth);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragStateRef.current.isDragging) return;
      if (dragStateRef.current.pointerId !== event.pointerId) return;
      const delta = event.clientX - dragStateRef.current.startX;
      const finalWidth = clamp(dragStateRef.current.startWidth + delta, minWidth, maxWidth);
      finishDragging(finalWidth);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (dragStateRef.current.pointerId !== event.pointerId) return;
      finishDragging();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      dragStateRef.current.isDragging = false;
      dragStateRef.current.pointerId = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [finishDragging, maxWidth, minWidth]);

  return { width, onPointerDown };
};

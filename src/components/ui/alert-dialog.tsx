"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;

export const AlertDialogOverlay = ({ className }: { className?: string }) => (
  <AlertDialogPrimitive.Overlay className={cn("fixed inset-0 z-50 bg-black/30", className)} />
);

export const AlertDialogContent = ({
  children,
  className,
}: { children: ReactNode; className?: string }) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6",
        className,
      )}
    >
      {children}
    </AlertDialogPrimitive.Content>
  </AlertDialogPortal>
);

export const AlertDialogHeader = ({ children }: { children: ReactNode }) => (
  <div className="space-y-2">{children}</div>
);

export const AlertDialogFooter = ({ children }: { children: ReactNode }) => (
  <div className="mt-6 flex justify-end gap-2">{children}</div>
);

export const AlertDialogTitle = AlertDialogPrimitive.Title;
export const AlertDialogDescription = AlertDialogPrimitive.Description;
export const AlertDialogAction = AlertDialogPrimitive.Action;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ScrollAreaProps = {
  children: ReactNode;
  className?: string;
};

export const ScrollArea = ({ children, className }: ScrollAreaProps) => {
  return <div className={cn("overflow-auto", className)}>{children}</div>;
};

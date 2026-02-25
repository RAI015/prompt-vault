import type { ReactNode } from "react";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export const ScrollArea = ({ children, className, ...props }: ScrollAreaProps) => {
  return (
    <div className={cn("overflow-auto", className)} {...props}>
      {children}
    </div>
  );
};

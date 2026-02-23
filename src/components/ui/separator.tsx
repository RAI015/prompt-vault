import { cn } from "@/lib/utils";

type SeparatorProps = {
  className?: string;
};

export const Separator = ({ className }: SeparatorProps) => {
  return <div className={cn("h-px w-full bg-border", className)} />;
};

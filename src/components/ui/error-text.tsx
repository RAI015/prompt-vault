import type { ReactNode } from "react";

export const ErrorText = ({ children }: { children: ReactNode }) => {
  if (!children) {
    return null;
  }
  return <p className="text-sm text-red-600">{children}</p>;
};

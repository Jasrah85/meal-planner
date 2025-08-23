import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: DivProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 p-4 shadow-sm ${className}`}
      {...props}
    />
  );
}

import type { ReactNode } from "react";

export default function PublicLayout(props: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">{props.children}</div>
    </div>
  );
}


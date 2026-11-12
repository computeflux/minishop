"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-black !text-white !border-white/15 !shadow-none",
          description: "group-[.toast]:text-white/45",
          actionButton:
            "group-[.toast]:!bg-white group-[.toast]:!text-black",
          cancelButton:
            "group-[.toast]:!bg-white/10 group-[.toast]:!text-white/60",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };

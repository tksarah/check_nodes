"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  form?: string;
};

export function SubmitButton({
  children,
  pendingLabel = "Working...",
  className,
  form
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending} form={form}>
      {pending ? (
        <>
          <LoaderCircle className="spin" size={16} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

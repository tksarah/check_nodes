"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
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
  const [externalPending, setExternalPending] = useState(false);
  const isPending = pending || externalPending;

  function handleClick() {
    if (!form) return;

    const externalForm = document.getElementById(form);

    if (externalForm instanceof HTMLFormElement && externalForm.reportValidity()) {
      setExternalPending(true);
    }
  }

  return (
    <button
      aria-busy={isPending}
      className={className}
      type="submit"
      disabled={isPending}
      form={form}
      onClick={handleClick}
    >
      {isPending ? (
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

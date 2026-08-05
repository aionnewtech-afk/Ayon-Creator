"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Modal simples sobre o elemento nativo `<dialog>` — foco/ESC/backdrop já
 * vêm de graça do navegador, sem precisar de uma dependência nova (primeiro
 * modal do produto, Missão 10).
 */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "w-full max-w-md rounded-lg border border-border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/50",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

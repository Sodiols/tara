"use client";

import { Minus, Plus } from "lucide-react";

interface QuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
  /**
   * The selected variant's own stock, capped at the per-line limit — never the
   * product's total across variants. Zero means the current combination cannot
   * be bought, and both steppers are then disabled rather than the control
   * being hidden, so the row does not jump as the selection changes.
   */
  max?: number;
}

export function QuantitySelector({ quantity, onChange, max = 10 }: QuantitySelectorProps) {
  const ceiling = Math.max(0, max);
  return (
    <div>
      <span className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-muted block mb-2">
        {"Quantity"}
      </span>
      <div className="inline-flex items-center border border-border">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => onChange(Math.max(1, quantity - 1))}
          className="p-3 hover:bg-beige transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          disabled={quantity <= 1 || ceiling === 0}
        >
          <Minus size={14} />
        </button>
        <span className="w-10 text-center font-sans font-medium text-sm" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => onChange(Math.min(ceiling, quantity + 1))}
          className="p-3 hover:bg-beige transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          disabled={quantity >= ceiling}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

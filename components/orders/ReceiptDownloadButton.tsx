"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ReceiptDownloadButton({ orderNumber, trackingToken, className }: { orderNumber: string; trackingToken?: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/receipt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackingToken }),
      });
      if (!response.ok) throw new Error("Receipt unavailable");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `TARA-Order-${orderNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("We could not download the receipt. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return <div className={className}><Button type="button" variant="outline" onClick={download} loading={loading}><Download size={16} aria-hidden="true" /> Download receipt</Button>{error && <p role="alert" className="mt-2 text-xs text-wine">{error}</p>}</div>;
}

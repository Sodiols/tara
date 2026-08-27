import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseOrderReceiptSnapshot } from "@/lib/order-receipt";
import { generateOrderReceiptPdf } from "@/lib/pdf/order-receipt";
import { getStoreIdentity } from "@/lib/supabase/queries/settings";
import { consumeDurableLimit, guardPublicAction } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ orderNumber: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Receipt service is unavailable." }, { status: 503 });
  const { orderNumber: rawOrderNumber } = await context.params;
  const orderNumber = rawOrderNumber.trim().slice(0, 40);
  if (!/^[A-Za-z0-9-]+$/.test(orderNumber)) return NextResponse.json({ error: "Invalid order number." }, { status: 400 });

  let trackingToken: string | null = null;
  try {
    const body = await request.json();
    trackingToken = typeof body?.trackingToken === "string" ? body.trackingToken.trim().slice(0, 100) : null;
  } catch {
    // An authenticated account download does not need a request body.
  }

  const { fingerprint, result: throttle } = await guardPublicAction("receipt", 20, 600);
  if (!throttle.allowed || !(await consumeDurableLimit("receipt", fingerprint))) {
    return NextResponse.json(
      { error: "Too many receipt requests. Please wait a few minutes." },
      { status: 429, headers: { "retry-after": "600" } },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_customer_receipt", { p_order_number: orderNumber, p_tracking_token: trackingToken });
  const snapshot = parseOrderReceiptSnapshot(data);
  if (error || !snapshot) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

  const pdf = await generateOrderReceiptPdf(snapshot, await getStoreIdentity());
  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="TARA-Order-${orderNumber}.pdf"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

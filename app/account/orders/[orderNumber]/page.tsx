import { notFound } from "next/navigation";
import { getOrder } from "@/lib/supabase/queries/orders";
import { Container } from "@/components/layout/Container";
import { formatPrice } from "@/lib/utils";
import { submitReviewAction } from "@/lib/supabase/actions/reviews";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const result = await getOrder(orderNumber);
  if (!result) notFound();
  return (
    <Container className="py-10 lg:py-14">
      <h1 className="font-serif text-3xl text-ink">{result.order.order_number}</h1>
      <p className="mt-2 text-sm capitalize text-muted">{result.order.status.replaceAll("_", " ")}</p>
      <div className="mt-8 divide-y divide-border border-y border-border">
        {result.items.map((item) => <div key={item.id} className="py-4 text-sm"><div className="flex justify-between gap-4"><span>{item.product_name_en} · {item.size} · {item.colour_en} × {item.quantity}</span><strong>{formatPrice(Number(item.line_total))}</strong></div>{result.order.status === "delivered" && <form action={async (formData) => { "use server"; await submitReviewAction(formData); }} className="mt-4 grid gap-2 rounded-panel bg-beige/40 p-4 sm:grid-cols-[100px_1fr_auto]"><input type="hidden" name="productId" value={item.product_id} /><input type="hidden" name="orderItemId" value={item.id} /><select name="rating" aria-label="Rating" className="h-10 border border-border bg-white px-2">{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}</select><input name="commentEn" aria-label="Review" placeholder="Share your review" className="h-10 border border-border bg-white px-3" required minLength={10} /><button className="h-10 bg-wine px-4 text-white">Submit review</button></form>}</div>)}
      </div>
      <div className="ml-auto mt-6 max-w-sm space-y-2 text-sm"><p className="flex justify-between"><span>Subtotal</span><span>{formatPrice(Number(result.order.subtotal))}</span></p><p className="flex justify-between"><span>Delivery</span><span>{formatPrice(Number(result.order.delivery_fee))}</span></p><p className="flex justify-between border-t border-border pt-3 text-base font-semibold"><span>Total</span><span>{formatPrice(Number(result.order.total))}</span></p></div>
    </Container>
  );
}

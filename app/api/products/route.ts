import { NextResponse, type NextRequest } from "next/server";
import { getProductBySlug, searchProducts } from "@/lib/supabase/queries/products";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const slugs = request.nextUrl.searchParams
    .get("slugs")
    ?.split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (query) return NextResponse.json(await searchProducts(query, 8));
  if (slugs?.length) {
    const products = await Promise.all(slugs.map(getProductBySlug));
    return NextResponse.json(products.filter(Boolean));
  }
  return NextResponse.json([]);
}

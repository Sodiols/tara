import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getProductVariants,
  getRelatedProducts,
} from "@/lib/supabase/queries/products";
import { ProductDetailClient } from "@/components/product/ProductDetailClient";
import { siteConfig } from "@/data/site";
import { categoryHref, humanizeSlug } from "@/lib/utils";
import { jsonLdScriptProps } from "@/lib/json-ld";
import {
  NOINDEX_NOFOLLOW,
  SCHEMA_IDS,
  absoluteUrl,
  breadcrumbSchema,
  buildMetadata,
  metaDescription,
} from "@/lib/seo";
import type { Product } from "@/types";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/** The trail shown on the page and published as BreadcrumbList — one source. */
function productBreadcrumb(product: Product) {
  // Only the built-in categories have a page of their own. A staff-created
  // category has no route, so it is left out of the trail entirely rather than
  // published as a ListItem pointing at a URL that returns 404.
  const categoryPath = categoryHref(product.category);
  return [
    { name: "Home", path: "/" },
    ...(categoryPath
      ? [{
          // The category's real name, not its URL slug — "Two Piece" rather
          // than "two-piece". The two differ deliberately: the slug is
          // the stable identifier, the name is the wording.
          name: product.categoryName ?? humanizeSlug(product.category),
          path: categoryPath,
        }]
      : []),
    { name: product.name, path: `/product/${product.slug}` },
  ];
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  // A missing product renders notFound() below. Its metadata must say so too —
  // otherwise a 404 that happens to return HTML is an indexable empty page.
  if (!product) {
    return {
      title: "Product not found",
      robots: NOINDEX_NOFOLLOW,
    };
  }

  // The staff override wins; the product's own name and description are the
  // fallback. `seoTitle` is treated as absolute because someone who takes the
  // trouble to write one has written the whole title — appending "| TARA" to
  // it is how "TARA Silk Kameez | TARA" happens.
  const hasCustomTitle = Boolean(product.seoTitle);

  return buildMetadata({
    title: product.seoTitle ?? product.name,
    absoluteTitle: hasCustomTitle,
    description: metaDescription(product.seoDescription, product.description),
    path: `/product/${product.slug}`,
    images: product.images,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // The two are independent of each other, so they overlap rather than queue.
  const [variants, relatedProducts] = await Promise.all([
    getProductVariants(product.id),
    getRelatedProducts(product),
  ]);

  const productUrl = absoluteUrl(`/product/${product.slug}`);
  // Availability from the real matrix, which is also what the page's selector
  // and place_order() use. `product.stock` is sum(stock) across variants and
  // would still say InStock for a product whose every variant is sold out
  // except one that is not orderable.
  const inStock = variants.some((variant) => variant.available);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    url: productUrl,
    name: product.name,
    description: product.description,
    image: product.media.map((item) => item.url),
    sku: product.productCode,
    brand: { "@type": "Brand", name: siteConfig.name },
    ...(product.categoryName ? { category: product.categoryName } : {}),
    ...(product.fabric ? { material: product.fabric } : {}),
    // Only colours and sizes belonging to ACTIVE variants reach the storefront
    // Product, so this never advertises a combination that cannot be bought.
    ...(product.colours.length > 0
      ? { color: product.colours.map((colour) => colour.name) }
      : {}),
    ...(product.sizes.length > 0 ? { size: product.sizes } : {}),
    offers: {
      "@type": "Offer",
      "@id": `${productUrl}#offer`,
      url: productUrl,
      priceCurrency: "BDT",
      price: product.price,
      // The store sells new goods only. Nothing else here is asserted without
      // a real field behind it: no GTIN, no MPN, no priceValidUntil, no
      // shippingDetails and no hasMerchantReturnPolicy, because TARA operates
      // an exchange policy rather than a returns policy in the sense Google
      // means, and an invented one is a structured-data penalty waiting.
      itemCondition: "https://schema.org/NewCondition",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@id": SCHEMA_IDS.organization },
    },
    // Rating and reviews come from the same approved set the page renders, so
    // structured data and visible content cannot disagree.
    ...(product.reviewCount > 0 && product.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(product.reviews.length > 0
      ? {
          review: product.reviews.slice(0, 5).map((review) => ({
            "@type": "Review",
            author: { "@type": "Person", name: review.author },
            datePublished: review.date,
            reviewRating: {
              "@type": "Rating",
              ratingValue: review.rating,
              bestRating: 5,
              worstRating: 1,
            },
            ...(review.title ? { name: review.title } : {}),
            reviewBody: review.comment,
          })),
        }
      : {}),
  };

  return (
    <>
      {/*
        Both blocks go through jsonLd(), which escapes `<`. A product name,
        description or review body is user- or staff-supplied text, and one
        containing `</script>` would otherwise close the block early and let
        everything after it be parsed as markup.
      */}
      <script {...jsonLdScriptProps(productSchema)} />
      <script {...jsonLdScriptProps(breadcrumbSchema(productBreadcrumb(product)))} />
      <ProductDetailClient
        product={product}
        variants={variants}
        relatedProducts={relatedProducts}
      />
    </>
  );
}

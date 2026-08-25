import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/supabase/queries/products";
import { ProductDetailClient } from "@/components/product/ProductDetailClient";
import { siteConfig } from "@/data/site";
import { categoryHref, humanizeSlug } from "@/lib/utils";
import { jsonLdScriptProps } from "@/lib/json-ld";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: product.images,
    },
    alternates: {
      canonical: `${siteConfig.url}/product/${product.slug}`,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const relatedProducts = await getRelatedProducts(product);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.productCode,
    brand: { "@type": "Brand", name: siteConfig.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "BDT",
      price: product.price,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${siteConfig.url}/product/${product.slug}`,
    },
    aggregateRating:
      product.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          }
        : undefined,
  };

  // Only the built-in categories have a page of their own. A staff-created
  // category has no route, so it is left out of the trail entirely rather than
  // published as a ListItem pointing at a URL that returns 404.
  const categoryPath = categoryHref(product.category);
  const breadcrumbTrail = [
    { name: "Home", item: siteConfig.url },
    ...(categoryPath
      ? [
          {
            // The category's real name, not its URL slug — "Ready Three Piece"
            // rather than "ready-three-piece".
            name: product.categoryName ?? humanizeSlug(product.category),
            item: `${siteConfig.url}${categoryPath}`,
          },
        ]
      : []),
    { name: product.name, item: `${siteConfig.url}/product/${product.slug}` },
  ];

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbTrail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  };

  return (
    <>
      {/*
        Both blocks go through jsonLd(), which escapes `<`. A product name,
        description or category label is staff-editable text, and one containing
        `</script>` would otherwise close the block early and let everything
        after it be parsed as markup.
      */}
      <script {...jsonLdScriptProps(productSchema)} />
      <script {...jsonLdScriptProps(breadcrumbSchema)} />
      <ProductDetailClient product={product} relatedProducts={relatedProducts} />
    </>
  );
}

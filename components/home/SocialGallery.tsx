import Image from "next/image";
import { Instagram } from "lucide-react";
import { img, stockImages } from "@/lib/images";
import { Container } from "@/components/layout/Container";

const galleryImages = [
  stockImages.portraitB,
  stockImages.bagA,
  stockImages.portraitJ,
  stockImages.lifestyleB,
  stockImages.portraitI,
  stockImages.bagC,
];

/**
 * The Instagram link comes from the live store settings so a change of handle
 * is a settings edit rather than a deploy. The section hides itself entirely
 * when no Instagram URL is configured — six images linking nowhere would be
 * worse than no section.
 */
export function SocialGallery({
  instagramUrl,
  handle,
}: {
  instagramUrl: string;
  handle: string;
}) {
  if (!instagramUrl) return null;


  return (
    <Container as="section" className="py-12 sm:py-16 lg:py-24">
      <div className="text-center mb-10 lg:mb-14 flex flex-col items-center gap-3">
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] text-ink">{"Follow TARA"}</h2>
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-wine hover:underline underline-offset-4"
        >
          <Instagram size={16} /> {handle}
        </a>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 md:gap-4">
        {galleryImages.map((id, i) => (
          <a
            key={i}
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative aspect-square overflow-hidden bg-beige group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Image
              src={img(id, 400, 400)}
              alt={`${handle} ${i + 1}`}
              fill
              sizes="(max-width: 768px) 33vw, 16vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </a>
        ))}
      </div>
    </Container>
  );
}

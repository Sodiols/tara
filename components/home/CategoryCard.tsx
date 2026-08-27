import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface CategoryCardProps {
  image: string;
  name: string;
  exploreLabel: string;
  href: string;
}

export function CategoryCard({ image, name, exploreLabel, href }: CategoryCardProps) {
  return (
    <Link
      href={href}
      className="group relative block aspect-[4/5] w-full overflow-hidden bg-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <Image
        src={image}
        alt={name}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/5 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <h3 className="font-serif text-xl sm:text-2xl text-white mb-1.5 line-clamp-1">{name}</h3>
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/90 group-hover:gap-2.5 transition-[gap] duration-200">
          {exploreLabel} <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

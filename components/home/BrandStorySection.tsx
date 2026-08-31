import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { img, stockImages } from "@/lib/images";
import { Container } from "@/components/layout/Container";
import styles from "./BrandStorySection.module.css";

/** A deliberately static editorial pause between the storefront sections. */
export function BrandStorySection() {
  return (
    <section className={styles.section} aria-labelledby="brand-story-heading" data-brand-story="">
      <Container>
        <div className={styles.composition}>
          <span className={styles.backdrop} aria-hidden="true">TARA</span>

          <p className={styles.eyebrow}>About TARA</p>

          <h2 id="brand-story-heading" className={styles.headline}>
            <span>Designed for your</span>{" "}
            <span>everyday <span className={styles.accent}>story</span></span>
          </h2>

          <figure className={styles.figure}>
            <div className={styles.portrait}>
              <Image
                src={img(stockImages.lifestyleA, 900, 1125)}
                alt="Fashion portrait of a woman in a mauve draped outfit against a soft rose backdrop."
                fill
                sizes="(min-width: 1308px) 496px, (min-width: 1280px) calc((100vw - 128px) * .42), (min-width: 1024px) calc((100vw - 96px) * .42), (min-width: 768px) calc((100vw - 64px) * .44), (min-width: 560px) 427px, calc((100vw - 40px) * .82)"
                className={styles.image}
              />
            </div>
            <figcaption className={styles.location}>Our story · Sylhet, Bangladesh</figcaption>
          </figure>

          <div className={styles.story}>
            <p className={styles.copy}>
              TARA brings together comfort, modern style, and thoughtful details for women across Bangladesh. Every collection is selected to help you feel confident, comfortable, and beautifully yourself.
            </p>
            <Link href="/about" className={styles.link}>
              Discover TARA <ArrowRight size={18} strokeWidth={1.25} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

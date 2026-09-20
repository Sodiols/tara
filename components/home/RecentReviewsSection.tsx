import { Container } from "@/components/layout/Container";
import { SectionHeader } from "@/components/layout/SectionHeader";

/**
 * Recent reviews.
 *
 * The heading only, on purpose: the section has its place on the homepage
 * before anybody has decided what belongs under it. Nothing is invented here —
 * when the shape of the reviews is settled, real reviews go in below this
 * header.
 */
export function RecentReviewsSection() {
  return (
    <section className="bg-white py-12 sm:py-16 lg:py-24">
      <Container>
        <SectionHeader eyebrow={"What Customers Say"} heading={"Recent Reviews"} className="mb-0" />
      </Container>
    </section>
  );
}

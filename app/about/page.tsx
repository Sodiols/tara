import type { Metadata } from "next";
import { AboutClient } from "@/components/AboutClient";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about TARA, a Sylhet-born clothing and accessories brand for the modern Bangladeshi woman.",
};

export default function AboutPage() {
  return <AboutClient />;
}

import type { Metadata } from "next";
import { FaqClient } from "@/components/FaqClient";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers to common questions about TARA orders, delivery, exchange, and payments.",
};

export default function FaqPage() {
  return <FaqClient />;
}

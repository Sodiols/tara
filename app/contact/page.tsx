import type { Metadata } from "next";
import { ContactClient } from "@/components/forms/ContactClient";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with TARA — visit our Sylhet showroom, call, WhatsApp, or send us a message.",
};

export default function ContactPage() {
  return <ContactClient />;
}

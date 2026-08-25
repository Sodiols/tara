import { formatTaka } from "@/lib/format";
import type { DeliverySettings } from "@/lib/delivery";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * The FAQ, with the delivery answers generated from the live settings.
 *
 * The two answers that quote a number used to be static strings holding
 * "৳1500", so an administrator raising the free-delivery threshold in
 * /admin/settings would have left the FAQ promising the old one — and the FAQ
 * is exactly where a shopper goes to check before they spend more to qualify.
 *
 * The rest are genuinely static: they describe policy, not configuration.
 */
export function faqItems(
  delivery: DeliverySettings,
  storeAddress: string,
): FaqItem[] {
  const freeDeliveryAnswer = delivery.freeDeliveryEnabled
    ? `Delivery is free in ${delivery.freeDeliveryDivision} on orders of ${formatTaka(delivery.freeDeliveryThreshold)} or more. Below that it is ${formatTaka(delivery.insideFee)}. Everywhere else in Bangladesh the charge is ${formatTaka(delivery.outsideFee)}. The exact amount is shown at checkout before you place your order.`
    : `Delivery is ${formatTaka(delivery.insideFee)} in ${delivery.freeDeliveryDivision} and ${formatTaka(delivery.outsideFee)} everywhere else in Bangladesh. The exact amount is shown at checkout before you place your order.`;

  return [
    {
      question: "What areas do you deliver to?",
      answer:
        "We deliver to all 64 districts of Bangladesh. Orders within Sylhet typically arrive in 2-4 business days, while other districts take 4-7 business days.",
    },
    {
      question: "How much is the delivery charge?",
      answer: freeDeliveryAnswer,
    },
    {
      question: "Can I exchange a product?",
      answer:
        "Yes, we offer easy exchange within 7 days of delivery as long as the item is unused and has its original tags attached.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "Cash on delivery only. Pay the delivery agent in cash when your order arrives — there is nothing to pay upfront, and we never ask for payment before delivery.",
    },
    {
      question: "How do I know which size to order?",
      answer:
        "Each ready-made product page includes detailed size measurements and model information. You can also refer to our full Size Guide.",
    },
    {
      question: "Do you have a physical store?",
      answer: storeAddress
        ? `Yes, our store is located at ${storeAddress}. You are welcome to visit us in person.`
        : "Yes. Contact us for directions to our showroom.",
    },
    {
      question: "Can I cancel my order?",
      answer:
        "Orders can be cancelled before they are shipped. Please contact our customer support team as soon as possible.",
    },
  ];
}

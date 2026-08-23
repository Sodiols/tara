export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    question: "What areas do you deliver to?",
    answer: "We deliver across Bangladesh. Orders within Sylhet typically arrive in 2-4 business days, while other districts take 4-7 business days.",
  },
  {
    question: "How much is the delivery charge?",
    answer: "Delivery is free in Sylhet for orders above ৳1500. Standard delivery charges apply for other areas and smaller orders, shown at checkout.",
  },
  {
    question: "Can I exchange a product?",
    answer: "Yes, we offer easy exchange within 7 days of delivery as long as the item is unused and has its original tags attached.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept Cash on Delivery across Bangladesh. Pay the delivery agent in cash when your order arrives — there is nothing to pay upfront.",
  },
  {
    question: "How do I know which size to order?",
    answer: "Each ready-made product page includes detailed size measurements and model information. You can also refer to our full Size Guide.",
  },
  {
    question: "Do you have a physical store?",
    answer: "Yes, our store is located at Batortal Bazar, Zakiganj, Sylhet. You are welcome to visit us in person.",
  },
  {
    question: "Can I cancel my order?",
    answer: "Orders can be cancelled before they are shipped. Please contact our customer support team as soon as possible.",
  },
];

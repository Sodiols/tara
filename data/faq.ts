import type { LocalizedText } from "@/types";

export interface FaqItem {
  question: LocalizedText;
  answer: LocalizedText;
}

export const faqItems: FaqItem[] = [
  {
    question: { en: "What areas do you deliver to?", bn: "আপনারা কোন কোন এলাকায় ডেলিভারি দেন?" },
    answer: {
      en: "We deliver across Bangladesh. Orders within Sylhet typically arrive in 2-4 business days, while other districts take 4-7 business days.",
      bn: "আমরা সারাদেশে ডেলিভারি দিয়ে থাকি। সিলেটের ভেতরে সাধারণত ২-৪ কার্যদিবসে এবং অন্যান্য জেলায় ৪-৭ কার্যদিবসে পণ্য পৌঁছায়।",
    },
  },
  {
    question: { en: "How much is the delivery charge?", bn: "ডেলিভারি চার্জ কত?" },
    answer: {
      en: "Delivery is free in Sylhet for orders above ৳1500. Standard delivery charges apply for other areas and smaller orders, shown at checkout.",
      bn: "সিলেটে ৳১৫০০ টাকার বেশি অর্ডারে ডেলিভারি ফ্রি। অন্যান্য এলাকা ও ছোট অর্ডারের ক্ষেত্রে চেকআউটে নির্দিষ্ট ডেলিভারি চার্জ দেখানো হবে।",
    },
  },
  {
    question: { en: "Can I exchange a product?", bn: "আমি কি পণ্য এক্সচেঞ্জ করতে পারি?" },
    answer: {
      en: "Yes, we offer easy exchange within 7 days of delivery as long as the item is unused and has its original tags attached.",
      bn: "হ্যাঁ, পণ্যটি অব্যবহৃত এবং মূল ট্যাগসহ থাকলে ডেলিভারির ৭ দিনের মধ্যে সহজেই এক্সচেঞ্জ করা যাবে।",
    },
  },
  {
    question: { en: "What payment methods do you accept?", bn: "আপনারা কোন পেমেন্ট পদ্ধতি গ্রহণ করেন?" },
    answer: {
      en: "We accept Cash on Delivery across Bangladesh, along with online payment options including bKash and card payments.",
      bn: "আমরা সারাদেশে ক্যাশ অন ডেলিভারি গ্রহণ করি, পাশাপাশি বিকাশ ও কার্ড পেমেন্টসহ অনলাইন পেমেন্টের সুবিধাও রয়েছে।",
    },
  },
  {
    question: { en: "How do I know which size to order?", bn: "আমি কীভাবে বুঝব কোন সাইজ অর্ডার করব?" },
    answer: {
      en: "Each ready-made product page includes detailed size measurements and model information. You can also refer to our full Size Guide.",
      bn: "প্রতিটি রেডি-মেড পণ্যের পাতায় বিস্তারিত সাইজ মাপ ও মডেলের তথ্য দেওয়া থাকে। এছাড়াও আপনি আমাদের সম্পূর্ণ সাইজ গাইড দেখতে পারেন।",
    },
  },
  {
    question: { en: "Do you have a physical store?", bn: "আপনাদের কি কোনো শোরুম আছে?" },
    answer: {
      en: "Yes, our store is located at Batortal Bazar, Zakiganj, Sylhet. You are welcome to visit us in person.",
      bn: "হ্যাঁ, আমাদের শোরুম বটেরতল বাজার, জকিগঞ্জ, সিলেটে অবস্থিত। আপনি সরাসরি আমাদের শোরুমে আসতে পারেন।",
    },
  },
  {
    question: { en: "Can I cancel my order?", bn: "আমি কি আমার অর্ডার বাতিল করতে পারি?" },
    answer: {
      en: "Orders can be cancelled before they are shipped. Please contact our customer support team as soon as possible.",
      bn: "পণ্য পাঠানোর আগ পর্যন্ত অর্ডার বাতিল করা যাবে। অনুগ্রহ করে দ্রুত আমাদের কাস্টমার সাপোর্ট টিমের সাথে যোগাযোগ করুন।",
    },
  },
];

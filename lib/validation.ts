import { z } from "zod";

const email = z.string().trim().email();
const password = z
  .string()
  .min(8)
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");
const bangladeshPhone = z
  .string()
  .trim()
  .regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Enter a valid Bangladesh mobile number.");

export const loginSchema = z.object({
  email,
  password: z.string().min(6),
  returnTo: z.string().optional(),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: bangladeshPhone,
    preferredLanguage: z.enum(["en", "bn"]).default("en"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: bangladeshPhone,
  preferredLanguage: z.enum(["en", "bn"]),
});

export const addressSchema = z.object({
  id: z.string().uuid().optional(),
  recipientName: z.string().trim().min(2).max(100),
  phone: bangladeshPhone,
  division: z.string().trim().min(2).max(80),
  district: z.string().trim().min(2).max(80),
  upazila: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(160),
  postalCode: z.string().trim().max(20).optional(),
  fullAddress: z.string().trim().min(8).max(500),
  deliveryNote: z.string().trim().max(500).optional(),
  isDefault: z.boolean().default(false),
});

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z.union([email, z.literal("")]).optional(),
  customerPhone: bangladeshPhone,
  deliveryMethod: z.enum(["standard", "express"]),
  paymentMethod: z.literal("cash_on_delivery"),
  customerNote: z.string().trim().max(500).optional(),
  shippingAddress: z.object({
    division: z.string().min(2),
    district: z.string().min(2),
    upazila: z.string().min(2),
    area: z.string().min(2),
    fullAddress: z.string().min(8),
  }),
  couponCode: z.string().trim().max(50).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1),
});

export const newsletterSchema = z.object({ email });
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  phone: z.union([bangladeshPhone, z.literal("")]).optional(),
  message: z.string().trim().min(10).max(3000),
});

export const reviewSchema = z.object({
  productId: z.string().uuid(),
  orderItemId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  commentEn: z.string().trim().min(10).max(2000),
  commentBn: z.string().trim().max(2000).optional(),
});

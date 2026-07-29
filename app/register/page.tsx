import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = params.returnTo
    ? `&returnTo=${encodeURIComponent(params.returnTo)}`
    : "";
  redirect(`/login?mode=register${returnTo}`);
}

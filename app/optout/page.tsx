import OptoutClient from "./optout-client";

export const dynamic = "force-dynamic";

export default async function OptoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const email = (Array.isArray(sp.e) ? sp.e[0] : sp.e) ?? "";
  return <OptoutClient email={email} />;
}

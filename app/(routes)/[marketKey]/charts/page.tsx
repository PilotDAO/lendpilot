import { redirect } from "next/navigation";

export default async function ChartsPage({
  params,
}: {
  params: Promise<{ marketKey: string }> | { marketKey: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  // Redirect to supply-change page
  redirect(`/${resolvedParams.marketKey}/supply-change`);
}

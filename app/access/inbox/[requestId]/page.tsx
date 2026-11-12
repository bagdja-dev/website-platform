import { redirect } from "next/navigation";

type LegacyInboxPageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function LegacyInboxPage({
  params,
}: LegacyInboxPageProps) {
  const { requestId } = await params;
  redirect(`/inbox?requestId=${encodeURIComponent(requestId)}`);
}

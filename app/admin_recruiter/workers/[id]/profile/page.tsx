import { redirect } from "next/navigation";

export default function WorkerProfileRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/admin_recruiter/new/profile/${params.id}`);
}


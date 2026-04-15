import { redirect } from "next/navigation";

export default function WorkerChecklistRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/admin_recruiter/new/checklist/${params.id}`);
}


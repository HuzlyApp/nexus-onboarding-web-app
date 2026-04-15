import { redirect } from "next/navigation";

export default function WorkerProfileResumeRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/admin_recruiter/new/profile/resume/${params.id}`);
}


import { redirect } from "next/navigation";

export default function WorkerProfileNotesRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/admin_recruiter/new/profile/notes/${params.id}`);
}


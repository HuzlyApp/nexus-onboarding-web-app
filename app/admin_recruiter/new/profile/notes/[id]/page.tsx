"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DetailedCandidateHeader from "../../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../../components/DetailedTabs";

type WorkerProfilePayload = {
  worker: {
    first_name: string | null;
    last_name: string | null;
    job_role: string | null;
  };
};

export default function NewApplicantProfileNotesPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WorkerProfilePayload | null>(null);

  useEffect(() => {
    async function run() {
      if (!id) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(id)}`);
        const json = (await res.json()) as WorkerProfilePayload;
        if (res.ok) setProfile(json);
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [id]);

  const candidateName = useMemo(() => {
    const n = `${profile?.worker?.first_name ?? ""} ${profile?.worker?.last_name ?? ""}`.trim();
    return n || "John Doe";
  }, [profile?.worker?.first_name, profile?.worker?.last_name]);
  const candidateRole = profile?.worker?.job_role || "Licensed Practical Nurse , LPN";
  const detailsHref = id ? `/admin_recruiter/new/profile/${id}` : "/admin_recruiter/new/profile";
  const resumeHref = id ? `/admin_recruiter/new/profile/resume/${id}` : "/admin_recruiter/new/profile/resume";
  const notesHref = id ? `/admin_recruiter/new/profile/notes/${id}` : "/admin_recruiter/new/profile/notes";

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-[1300px] mx-auto">
        <DetailedCandidateHeader
          name={candidateName}
          role={candidateRole}
          loading={loading}
        />
        <DetailedTabs applicantId={id} activeTab="Profile" />

        <div className="mb-4 flex justify-center">
          <div className="h-9 w-[327px] rounded-xl bg-[#F8FAFC] p-1">
            <div className="grid h-full grid-cols-3 gap-1">
              <Link
                href={detailsHref}
                className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
              >
                Details
              </Link>
              <Link
                href={resumeHref}
                className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
              >
                Resume
              </Link>
              <Link
                href={notesHref}
                className="inline-flex items-center justify-center rounded-lg bg-[#0D9488] text-sm font-medium leading-5 text-white"
              >
                Notes
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-3xl p-8">
        <div className="text-sm text-gray-600">Profile</div>
        <div className="text-2xl font-semibold text-gray-600 mt-1">Notes</div>
        <div className="text-sm text-gray-600 mt-3">
          Placeholder page so the Profile sub-tabs don’t 404. We can match your Notes UI next.
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href={detailsHref}
            className="px-4 py-2 rounded-2xl border border-zinc-200 text-sm hover:bg-zinc-50"
          >
            Back to Details
          </Link>
          <Link
            href={resumeHref}
            className="px-4 py-2 rounded-2xl border border-zinc-200 text-sm hover:bg-zinc-50"
          >
            Resume
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}


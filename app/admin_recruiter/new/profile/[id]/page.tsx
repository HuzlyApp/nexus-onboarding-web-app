"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  LogOut,
  Menu,
  Plus,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";

type OnboardingStep = {
  id: string;
  label: string;
  state: "complete" | "in_progress" | "pending";
  detail?: string;
};

type ProfilePayload = {
  worker: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    job_role: string | null;
    created_at: string | null;
    updated_at: string | null;
    status: string;
    status_label: string;
    date_of_birth: string | null;
    years_experience: number | null;
    hourly_rate: string | null;
    ssn_last_four: string | null;
  };
  documents: {
    updated_at: string | null;
    nursing_license_url: boolean;
    tb_test_url: boolean;
    cpr_certification_url: boolean;
    identity_uploaded: boolean;
  } | null;
  references: Array<{ id: string; name: string; phone: string | null; email: string | null }>;
  skillAssessments: { completed: number; total: number };
  onboardingSteps: OnboardingStep[];
  activity: { source: string; created_at: string | null; updated_at: string | null };
  requirements: {
    resume_path: string | null;
    resume_url: string | null;
  } | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function stepDotClass(state: OnboardingStep["state"]) {
  if (state === "complete") return "bg-teal-600";
  if (state === "in_progress") return "bg-amber-500";
  return "bg-zinc-300";
}

export default function NewApplicantProfilePage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const isWorkerRoute = pathname?.startsWith("/admin_recruiter/workers/") ?? false;
  const base = "/admin_recruiter/new";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfilePayload | null>(null);

  useEffect(() => {
    async function run() {
      if (!applicantId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as ProfilePayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load profile");
        setData(json);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [applicantId]);

  const w = data?.worker;
  const candidateName = useMemo(() => {
    const n = `${w?.first_name ?? ""} ${w?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [w?.first_name, w?.last_name]);

  const candidateRole = w?.job_role || "N/A";
  const candidateLocation = useMemo(() => {
    const parts = [w?.city ?? "", w?.state ?? "", w?.zip ?? ""].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }, [w?.city, w?.state, w?.zip]);

  const tabLink = (label: string, href: string, active?: boolean) => (
    <Link
      href={href}
      className={`text-xs px-3 py-1.5 rounded-xl border transition ${
        active
          ? "border-[#7AA6FF] bg-white text-gray-600"
          : "border-zinc-200 bg-white/60 text-gray-600 hover:bg-white"
      }`}
    >
      {label}
    </Link>
  );

  const id = applicantId ?? "";

  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0A1F1C] text-white transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="px-6 py-8 flex items-center gap-3 border-b border-white/10">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center">
              <span className="text-[#0A1F1C] font-bold text-3xl">N</span>
            </div>
            <div>
              <div className="font-semibold text-2xl tracking-tight">Nexus</div>
              <div className="text-xs text-teal-400 -mt-1">MedPro Staffing</div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-8 space-y-1">
            <div className="px-4 text-xs uppercase tracking-widest text-teal-400/70 mb-4">
              PERSONAL SETTINGS
            </div>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
            >
              Profile
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
            >
              Account
            </a>

            <div className="px-4 pt-8 text-xs uppercase tracking-widest text-teal-400/70 mb-4">
              TEAM MANAGEMENT
            </div>

            {[
              { label: "Candidates", href: "/admin_recruiter/candidates", icon: Users },
              { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
              { label: "Pending", href: "/admin_recruiter/pending", icon: UserCheck },
              { label: "Approved", href: "/admin_recruiter/approved", icon: UserCheck },
              { label: "Disapproved", href: "/admin_recruiter/disapproved", icon: UserX },
              { label: "Workers", href: "/admin_recruiter/workers", icon: Briefcase },
              { label: "Schedule", href: "/admin_recruiter/schedule", icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all ${
                    isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            <div className="px-4 pt-10">
              <a
                href="#"
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
              >
                <Settings className="w-5 h-5" /> Settings
              </a>
            </div>
          </nav>

          <div className="p-6 border-t border-white/10">
            <button className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/10 rounded-2xl">
              <LogOut className="w-5 h-5" /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen((v) => !v)} className="lg:hidden text-gray-600">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="font-semibold text-2xl">{isWorkerRoute ? "Worker" : "New Applicant"}</div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Online
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-medium text-sm">Sean Smith</div>
                <div className="text-xs text-gray-600">Manager</div>
              </div>
              <img
                src="https://i.pravatar.cc/128?u=sean"
                alt="Sean Smith"
                className="w-9 h-9 rounded-full object-cover"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-[1320px] mx-auto">
            <div className="mb-5 text-xs text-gray-600">
              Admin - {isWorkerRoute ? "Worker" : "New Applicant"} Detailed Page - Details
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#9CC3FF] overflow-hidden shadow-sm bg-[linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:34px_34px] bg-white/70">
              <div className="p-6 flex items-start justify-between gap-6 border-b border-[#9CC3FF]/30 bg-white/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold text-sm">
                    {initials(candidateName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-lg font-semibold text-gray-600">
                        {loading ? "Loading..." : candidateName}
                      </div>
                      <span className="text-[11px] px-3 py-1 rounded-full bg-white/70 border border-zinc-200 text-gray-600 font-medium">
                        {w?.status_label ?? "—"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">{candidateRole}</div>
                    <div className="text-xs text-gray-600">{candidateLocation}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="bg-white/70 border border-[#9CC3FF] text-gray-600 px-5 py-2.5 rounded-2xl hover:bg-white transition text-sm"
                  >
                    <Plus className="inline-block w-4 h-4 mr-2" />
                    New Appointment
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-[#9CC3FF]/20 bg-white/30">
                <div className="flex flex-wrap gap-2">
                  {tabLink("Checklist", `${base}/checklist/${id}`, false)}
                  {tabLink("Profile", `${base}/profile/${id}`, true)}
                  {tabLink("Attachments", `${base}/attachments/${id}`, false)}
                  {tabLink("Skill Assessments", `${base}/skill-assessments/${id}`, false)}
                  {tabLink("Authorization", `${base}/authorization/${id}`, false)}
                  {tabLink("Activities", `${base}/activities/${id}`, false)}
                  {tabLink("Facility Assignments", `${base}/facility-assignments/${id}`, false)}
                  {tabLink("Agreement", `${base}/agreement/${id}`, false)}
                  {tabLink("History", `${base}/history/${id}`, false)}
                </div>
              </div>

              <div className="px-6 py-4">
                <div className="inline-flex items-center gap-2 bg-white/70 border border-zinc-200 rounded-3xl p-1">
                  <Link
                    href={`${base}/profile/${id}`}
                    className="text-xs px-4 py-2 rounded-2xl bg-teal-700 text-white"
                  >
                    Details
                  </Link>
                  <Link
                    href={`${base}/profile/resume/${id}`}
                    className="text-xs px-4 py-2 rounded-2xl text-gray-600 hover:bg-white/60"
                  >
                    Resume
                  </Link>
                  <Link
                    href={`${base}/profile/notes/${id}`}
                    className="text-xs px-4 py-2 rounded-2xl text-gray-600 hover:bg-white/60"
                  >
                    Notes
                  </Link>
                </div>
              </div>

              <div className="p-6 grid grid-cols-12 gap-6">
                <section className="col-span-12 lg:col-span-4 space-y-6">
                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="text-sm font-semibold text-gray-600 mb-4">Candidate Details</div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {(
                        [
                          ["First Name", w?.first_name ?? "—"],
                          ["Last Name", w?.last_name ?? "—"],
                          ["Date of Birth", w?.date_of_birth ? formatDate(w.date_of_birth) : "—"],
                          ["Email Address", w?.email ?? "—"],
                          [
                            "Years of experience",
                            w?.years_experience != null ? `${w.years_experience} yrs` : "—",
                          ],
                          ["Street address", w?.address1 ?? "—"],
                          ["City", w?.city ?? "—"],
                          ["State", w?.state ?? "—"],
                          ["Zip Code", w?.zip ?? "—"],
                          ["Phone Number", w?.phone ?? "—"],
                          ["Last four of SSN", w?.ssn_last_four ?? "—"],
                          ["Hourly rate", w?.hourly_rate ? `$${w.hourly_rate}/hr` : "—"],
                          [
                            "Resume file",
                            data?.requirements?.resume_url ? (
                              <Link
                                key="resume-link"
                                href={`${base}/profile/resume/${id}`}
                                className="text-teal-700 font-medium hover:underline"
                              >
                                View / download
                              </Link>
                            ) : (
                              "—"
                            ),
                          ],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="col-span-2 grid grid-cols-2 gap-3">
                          <div className="text-gray-600">{k}</div>
                          <div className="text-gray-600 break-all">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-semibold text-gray-600">References</div>
                    </div>
                    {data && data.references.length > 0 ? (
                      <div className="space-y-3">
                        {data.references.map((r, i) => (
                          <div
                            key={r.id}
                            className="rounded-xl border border-zinc-200/70 bg-white/60 p-3 text-xs"
                          >
                            <div className="font-medium text-gray-600">
                              Reference {i + 1}: {r.name}
                            </div>
                            <div className="text-gray-600 mt-1">{r.phone ?? "—"}</div>
                            <div className="text-gray-600">{r.email ?? "—"}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600">No references on file yet.</div>
                    )}
                  </div>

                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-semibold text-gray-600">License &amp; documents</div>
                    </div>
                    {data?.documents?.nursing_license_url ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-gray-600">
                        Nursing license document on file. TB / CPR / ID flags:{" "}
                        {[data.documents.tb_test_url && "TB", data.documents.cpr_certification_url && "CPR", data.documents.identity_uploaded && "ID"]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600">No nursing license document uploaded yet.</div>
                    )}
                  </div>

                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="text-sm font-semibold text-gray-600 mb-4">Activity</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {(
                        [
                          ["Source", data?.activity.source ?? "—"],
                          ["Created", formatDate(data?.activity.created_at)],
                          ["Last updated", formatRelative(data?.activity.updated_at)],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="col-span-2 grid grid-cols-2 gap-3">
                          <div className="text-gray-600">{k}</div>
                          <div className="text-gray-600">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="text-sm font-semibold text-gray-600 mb-4">Activity History</div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-600/10 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-teal-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-gray-600">
                            Record created for {candidateName}
                          </div>
                          <div className="text-[11px] text-gray-600">
                            {formatRelative(data?.activity.created_at)}
                          </div>
                        </div>
                      </div>
                      {data?.activity.updated_at &&
                      data.activity.updated_at !== data.activity.created_at ? (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-600/10 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-teal-700" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-gray-600">Profile last updated</div>
                            <div className="text-[11px] text-gray-600">
                              {formatRelative(data.activity.updated_at)}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="col-span-12 lg:col-span-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                      <div className="text-sm font-semibold text-gray-600 mb-2">Education</div>
                      <div className="text-xs text-gray-600">
                        {data?.requirements?.resume_path
                          ? "Structured education fields are not stored separately; see the uploaded resume."
                          : "From resume (not stored on worker yet)"}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">—</div>
                    </div>

                    <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                      <div className="text-sm font-semibold text-gray-600 mb-2">Experience</div>
                      <div className="text-xs text-gray-600">Job role</div>
                      <div className="mt-2 text-xs text-gray-600">{candidateRole}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                      <div className="text-sm font-semibold text-gray-600 mb-2">Skills</div>
                      <div className="text-xs text-gray-600">
                        Structured skills will appear when stored with the applicant profile.
                      </div>
                      <div className="mt-2 text-xs text-gray-600">—</div>
                    </div>

                    <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                      <div className="text-sm font-semibold text-gray-600 mb-2">Facilities assigned</div>
                      <div className="text-xs text-gray-600">No facility assignments in database yet.</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-semibold text-gray-600">Onboarding Progress</div>
                        <span className="text-[11px] px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">
                          In Progress
                        </span>
                      </div>

                      <div className="space-y-3 text-xs text-gray-600">
                        {(data?.onboardingSteps ?? []).map((s) => (
                          <div key={s.id} className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${stepDotClass(s.state)}`} />
                            <span className="flex-1">{s.label}</span>
                            {s.detail ? (
                              <span className="text-[11px] text-gray-600">{s.detail}</span>
                            ) : null}
                          </div>
                        ))}
                        {loading ? (
                          <div className="text-gray-600">Loading progress…</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                      <div className="text-sm font-semibold text-gray-600 mb-3">Skill assessments</div>
                      <div className="text-xs text-gray-600">
                        Completed {data?.skillAssessments.completed ?? 0} of {data?.skillAssessments.total ?? 0}{" "}
                        tracked quizzes.
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="text-sm font-semibold text-gray-600 mb-3">Remarks</div>
                    <div className="text-xs text-gray-600 mb-4">Use pipeline actions from the New / Pending lists to approve or move applicants.</div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/admin_recruiter/new"
                        className="text-xs px-4 py-2 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 transition inline-block text-center"
                      >
                        Back to New list
                      </Link>
                    </div>
                  </div>

                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-gray-600">Notes</div>
                      <Link
                        href={`${base}/profile/notes/${id}`}
                        className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 bg-white/70 hover:bg-white transition"
                      >
                        Open notes
                      </Link>
                    </div>
                    <div className="text-xs text-gray-600">Use the Notes tab for free-form recruiter notes.</div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Calendar,
  LogOut,
  Menu,
  Phone,
  Plus,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
type WorkerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  status_label?: string;
};

type WorkerProfileResponse = {
  worker: WorkerProfile;
  activity: {
    source: string;
    created_at: string | null;
    updated_at: string | null;
  };
};

type ActivityTab = "Calls" | "Inbox" | "Interview";

type CallLog = {
  id: string;
  title: string;
  when: string;
  duration: string;
  outcome: "Answered" | "Did not answered";
  attempt: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export default function NewApplicantActivitiesPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [active, setActive] = useState<ActivityTab>("Calls");
  const [leftNav, setLeftNav] = useState<"Recent Logs" | "History">("Recent Logs");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfileResponse | null>(null);

  useEffect(() => {
    async function fetchApplicant() {
      if (!applicantId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as WorkerProfileResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Failed to load profile (${res.status})`);
        }
        setProfile(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Failed to fetch applicant for activities:", msg, e);
        setLoadError(msg);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    fetchApplicant();
  }, [applicantId]);

  const applicant = profile?.worker ?? null;

  const candidateName = useMemo(() => {
    const n = `${applicant?.first_name ?? ""} ${applicant?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [applicant]);

  const candidateRole = applicant?.job_role || "N/A";
  const statusLabel = applicant?.status_label?.trim() || "New Applicant";

  /** No `call_logs` table yet — keep structure ready for a future API. */
  const callLogs: CallLog[] = useMemo(() => [], []);

  const historyCount = useMemo(() => {
    const u = profile?.activity?.updated_at;
    const c = profile?.activity?.created_at;
    if (u && c && u !== c) return 1;
    return 0;
  }, [profile?.activity?.created_at, profile?.activity?.updated_at]);

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

  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      {/* Sidebar */}
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

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen((v) => !v)} className="lg:hidden text-gray-600">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="font-semibold text-2xl">New Applicant</div>
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
            <div className="mb-5 text-xs text-gray-600">Admin - New Applicant Detailed Page - Activities</div>

            {loadError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {loadError}
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#9CC3FF] overflow-hidden shadow-sm bg-[linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:34px_34px] bg-white/70">
              {/* Top */}
              <div className="p-6 flex items-start justify-between gap-6 border-b border-[#9CC3FF]/30 bg-white/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold text-sm">
                    {initials(candidateName)}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-600">
                      {loading ? "Loading..." : candidateName}
                    </div>
                    <div className="text-xs text-gray-600">{candidateRole}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] px-3 py-1 rounded-full bg-white/70 border border-zinc-200 text-gray-600 font-medium">
                    {loading ? "…" : statusLabel}
                  </span>
                  <button className="bg-white/70 border border-[#9CC3FF] text-gray-600 px-5 py-2.5 rounded-2xl hover:bg-white transition text-sm">
                    <Plus className="inline-block w-4 h-4 mr-2" />
                    New Appointment
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 py-4 border-b border-[#9CC3FF]/20 bg-white/30">
                <div className="flex flex-wrap gap-2">
                  {tabLink("Checklist", `/admin_recruiter/new/checklist/${applicantId}`, false)}
                  {tabLink("Profile", `/admin_recruiter/new/profile/${applicantId}`, false)}
                  {tabLink("Attachments", `/admin_recruiter/new/attachments/${applicantId}`, false)}
                  {tabLink(
                    "Skill Assessments",
                    `/admin_recruiter/new/skill-assessments/${applicantId}`,
                    false
                  )}
                  {tabLink("Authorization", `/admin_recruiter/new/authorization/${applicantId}`, false)}
                  {tabLink("Activities", `/admin_recruiter/new/activities/${applicantId}`, true)}
                  {tabLink(
                    "Facility Assignments",
                    `/admin_recruiter/new/facility-assignments/${applicantId}`,
                    false
                  )}
                  {tabLink("Agreement", `/admin_recruiter/new/agreement/${applicantId}`, false)}
                  {tabLink("History", `/admin_recruiter/new/history/${applicantId}`, false)}
                </div>
              </div>

              <div className="p-6 grid grid-cols-12 gap-6">
                {/* Left mini-nav */}
                <aside className="col-span-3">
                  <div className="bg-white/70 border border-[#9CC3FF]/25 rounded-2xl p-4 h-full">
                    <div className="space-y-2">
                      {(
                        [
                          { key: "Recent Logs" as const, count: callLogs.length },
                          { key: "History" as const, count: historyCount },
                        ] as const
                      ).map(({ key: k, count }) => {
                        const isActive = leftNav === k;
                        return (
                          <button
                            key={k}
                            onClick={() => setLeftNav(k)}
                            className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl border text-xs transition ${
                              isActive
                                ? "border-teal-200 bg-white text-gray-600"
                                : "border-transparent text-gray-600 hover:bg-white"
                            }`}
                          >
                            <span>{k}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-gray-600 font-medium">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </aside>

                {/* Main */}
                <main className="col-span-9">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {(["Calls", "Inbox", "Interview"] as const).map((t) => {
                        const isActive = active === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setActive(t)}
                            className={`text-xs px-3 py-1.5 rounded-xl border transition ${
                              isActive
                                ? "border-teal-200 bg-white text-gray-600"
                                : "border-zinc-200 bg-white/60 text-gray-600 hover:bg-white"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="text-xs px-4 py-2 rounded-2xl border border-zinc-200 bg-white/70 hover:bg-white transition">
                        + Add a call log
                      </button>
                      <button className="text-xs px-4 py-2 rounded-2xl border border-zinc-200 bg-white/70 hover:bg-white transition flex items-center gap-2">
                        <Phone className="w-4 h-4 text-teal-700" />
                        Call
                      </button>
                    </div>
                  </div>

                  {active !== "Calls" ? (
                    <div className="bg-white/70 border border-[#9CC3FF]/25 rounded-2xl p-6 text-sm text-gray-600">
                      {active} for {candidateName} — connect an inbox or interview data source to show items
                      here.
                    </div>
                  ) : leftNav === "History" ? (
                    <div className="bg-white/70 border border-[#9CC3FF]/25 rounded-2xl p-6 text-sm text-gray-600">
                      {historyCount > 0 ? (
                        <p>
                          Last profile update tracked from onboarding activity. Full history export can be
                          wired when activity events are stored per worker.
                        </p>
                      ) : (
                        <p>No history entries yet.</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white/70 border border-[#9CC3FF]/25 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-semibold text-gray-600">Call History</div>
                        <div className="text-xs text-gray-600">
                          Actions taken{" "}
                          <span className="font-medium text-gray-600">{callLogs.length}</span>
                        </div>
                      </div>

                      {callLogs.length === 0 ? (
                        <div className="text-sm text-gray-600 py-10 text-center border border-dashed border-zinc-200 rounded-2xl">
                          No call logs recorded for{" "}
                          <span className="font-medium text-gray-600">{candidateName}</span> yet. Call logs
                          can be stored in a future call-log table and loaded here.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {callLogs.map((c) => {
                            const badge =
                              c.outcome === "Answered"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800";
                            return (
                              <div
                                key={c.id}
                                className="grid grid-cols-12 gap-4 items-center py-3 border-b border-zinc-100 last:border-b-0"
                              >
                                <div className="col-span-6 flex items-start gap-3">
                                  <div className="w-9 h-9 rounded-full bg-teal-600/10 flex items-center justify-center shrink-0">
                                    <Phone className="w-4 h-4 text-teal-700" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-gray-600 truncate">
                                      {c.title}
                                    </div>
                                    <div className="text-[11px] text-gray-600">{c.when}</div>
                                  </div>
                                </div>

                                <div className="col-span-2 text-[11px] text-gray-600">
                                  Duration: {c.duration}
                                </div>

                                <div className="col-span-2">
                                  <span
                                    className={`text-[11px] px-3 py-1 rounded-full font-medium ${badge}`}
                                  >
                                    {c.outcome}
                                  </span>
                                </div>

                                <div className="col-span-2 text-[11px] text-gray-600">{c.attempt}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


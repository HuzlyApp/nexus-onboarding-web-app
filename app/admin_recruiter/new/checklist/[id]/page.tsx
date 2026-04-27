"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  LogOut,
  Menu,
  MoreVertical,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";

type ItemState = "pending" | "complete" | "uploaded" | "answered" | "warning" | "not_reachable" | "not_applicable";

type ChecklistRow = {
  id: string;
  title: string;
  subtitle?: string;
  state: ItemState;
  optional?: boolean;
  checked?: boolean;
  detailLine?: string;
  badge?: string;
};

type ChecklistSection = {
  id: string;
  title: string;
  subtitle?: string;
  rows: ChecklistRow[];
};

type ChecklistPayload = {
  worker: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    job_role: string | null;
    city: string | null;
    state: string | null;
    created_at: string | null;
    status_label: string;
  };
  meta: {
    daysInStage: number;
    progressPercent: number;
    completedItems: number;
    totalItems: number;
    verifiedDocuments: { done: number; total: number };
    skillAssessments: { completed: number; total: number };
  };
  tracker: { labels: string[]; done: boolean[] };
  sections: ChecklistSection[];
};

function badgeClasses(state: ItemState): string {
  switch (state) {
    case "uploaded":
    case "complete":
    case "answered":
      return "bg-emerald-50 text-emerald-800 border-emerald-100";
    case "warning":
      return "bg-amber-50 text-amber-900 border-amber-100";
    case "not_reachable":
      return "bg-red-50 text-red-800 border-red-100";
    case "not_applicable":
      return "bg-slate-50 text-gray-600 border-slate-100";
    default:
      return "bg-amber-50 text-amber-800 border-amber-100";
  }
}

function RowBadge({ text, state }: { text: string; state: ItemState }) {
  return (
    <span
      className={`text-[11px] px-3 py-1 rounded-full font-medium border ${badgeClasses(state)}`}
    >
      {text}
    </span>
  );
}

export default function NewApplicantChecklistPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const isWorkerRoute = pathname?.startsWith("/admin_recruiter/workers/") ?? false;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ChecklistPayload | null>(null);

  useEffect(() => {
    async function run() {
      if (!applicantId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/worker-checklist?workerId=${encodeURIComponent(applicantId)}`);
        const json = (await res.json()) as ChecklistPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load checklist");
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

  const candidateName = useMemo(() => {
    const w = data?.worker;
    const n = `${w?.first_name ?? ""} ${w?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [data?.worker]);

  const candidateRole = data?.worker?.job_role || "N/A";
  const candidateLocation = useMemo(() => {
    const parts = [data?.worker?.city ?? "", data?.worker?.state ?? ""].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }, [data?.worker?.city, data?.worker?.state]);

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
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
              Profile
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
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
              <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
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
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden text-gray-600"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-baseline gap-3">
              <div className="font-semibold text-2xl">{isWorkerRoute ? "Worker" : "New Applicant"}</div>
              <Link
                href={isWorkerRoute ? "/admin_recruiter/workers" : "/admin_recruiter/new"}
                className="text-sm text-gray-600 hover:text-gray-600"
              >
                Back to {isWorkerRoute ? "Workers" : "New"}
              </Link>
            </div>
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
              Admin - {isWorkerRoute ? "Worker" : "New Applicant"} Detailed Page - Checklist
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              loading={loading}
            />
            <DetailedTabs applicantId={applicantId} activeTab="Checklist" />

            <div className="mx-auto flex h-[1762px] w-full max-w-[1300px] flex-col gap-[30px] overflow-hidden rounded-md border border-[#E5E7EB] bg-white p-5">
              <div className="hidden p-3 sm:p-4 border-b border-[#9CC3FF]/30 bg-white/40">
                <div className="mx-auto flex h-[92px] w-full max-w-[1300px] items-center justify-between rounded-md border border-[#D1D5DB] bg-white px-5">
                  <div className="flex items-center gap-3">
                    <img
                      src="/icons/admin-recruiter/user.svg"
                      alt="User"
                      className="h-[52px] w-[52px] shrink-0"
                    />
                    <div>
                      <div className="text-base font-semibold leading-6 text-[#0D9488]">
                        {loading ? "John Doe" : candidateName || "John Doe"}
                      </div>
                      <div className="mt-0.5 text-xs font-normal leading-4 text-[#4B5563]">
                        {candidateRole || "Licensed Practical Nurse , LPN"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-3 text-center text-xs font-semibold leading-4 text-[#111827] hover:bg-[#F9FAFB]"
                    >
                      New Applicant
                    </button>
                    <button
                      type="button"
                      aria-label="More options"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[#6B7280] hover:bg-[#F3F4F6]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-[30px]">
                <div className="h-[110px] w-full max-w-[1260px] rounded-md border border-[#0D9488] bg-[#F8FAFC] px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[20px] font-semibold leading-7 text-[#1F2937]">Progress Checklist Tracker</div>
                    <div className="text-[18px] font-normal leading-7 text-[#374151]">
                      Days in current stage:{" "}
                      <span className="font-semibold text-[#1F2937]">{data?.meta?.daysInStage ?? "—"} days</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="h-[10px] w-full max-w-[1168px] rounded-[100px] bg-[#ECF1F9] overflow-hidden">
                      <div
                        className="h-full rounded-[100px] bg-[#0D9488] transition-all"
                        style={{ width: `${data?.meta?.progressPercent ?? 0}%` }}
                      />
                    </div>
                    <div className="text-[18px] font-semibold leading-7 text-[#111827]">
                      {data?.meta?.progressPercent ?? 0}%
                    </div>
                  </div>
                </div>

                <main className="space-y-4">
                  {loading ? (
                    <div className="text-center py-16 text-gray-600">Loading checklist…</div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {(data?.sections ?? []).map((section) => (
                        <div
                          key={section.id}
                          className="bg-white/70 border border-[#9CC3FF]/30 rounded-2xl p-5"
                        >
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <div className="text-sm font-semibold text-gray-600">{section.title}</div>
                              {section.subtitle ? (
                                <div className="text-xs text-gray-600 mt-0.5">{section.subtitle}</div>
                              ) : null}
                            </div>
                          </div>

                          <div className="space-y-3">
                            {section.rows.map((row) => (
                              <div
                                key={row.id}
                                className="rounded-xl border border-zinc-200/70 bg-white/60 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-600">{row.title}</div>
                                    {row.subtitle ? (
                                      <div className="text-xs text-gray-600 mt-0.5">{row.subtitle}</div>
                                    ) : null}
                                  </div>
                                  <RowBadge text={row.badge ?? "Pending"} state={row.state} />
                                </div>

                                {typeof row.checked === "boolean" ? (
                                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                                    <div
                                      className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                                        row.checked
                                          ? "border-teal-600 bg-teal-600"
                                          : "border-zinc-300 bg-white"
                                      }`}
                                    >
                                      {row.checked ? (
                                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                      ) : null}
                                    </div>
                                    <span>{row.checked ? "On file" : "Missing"}</span>
                                  </div>
                                ) : null}

                                {row.detailLine ? (
                                  <div className="mt-2 text-[11px] text-gray-600">{row.detailLine}</div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
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

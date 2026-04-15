"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  LogOut,
  Menu,
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

type ProfilePayload = {
  worker: WorkerProfile;
  activity: {
    source: string;
    created_at: string | null;
    updated_at: string | null;
  };
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return days === 1 ? "1 day ago" : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

function formatDateTimeParts(iso: string): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateLine: "—", timeLine: "—" };
  }
  const dateLine = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeLine = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return { dateLine, timeLine };
}

type HistoryItem = {
  id: string;
  action: string;
  ago: string;
  date: string;
  time: string;
};

function buildHistoryFromActivity(activity: ProfilePayload["activity"] | undefined): HistoryItem[] {
  if (!activity) return [];

  type Row = { id: string; action: string; at: string };
  const rows: Row[] = [];

  if (activity.created_at?.trim()) {
    rows.push({
      id: "created",
      action: "Applicant record created",
      at: activity.created_at.trim(),
    });
  }

  if (activity.updated_at?.trim()) {
    const u = activity.updated_at.trim();
    const c = activity.created_at?.trim();
    if (!c || u !== c) {
      rows.push({
        id: "updated",
        action: "Applicant profile updated",
        at: u,
      });
    }
  }

  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return rows.map((r) => {
    const { dateLine, timeLine } = formatDateTimeParts(r.at);
    return {
      id: r.id,
      action: r.action,
      ago: formatRelative(r.at),
      date: dateLine,
      time: timeLine,
    };
  });
}

export default function NewApplicantHistoryPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  useEffect(() => {
    async function fetchApplicant() {
      if (!applicantId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as ProfilePayload & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Failed to load profile (${res.status})`);
        }
        setProfile(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Failed to fetch applicant for history:", msg, e);
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

  const historyItems: HistoryItem[] = useMemo(
    () => buildHistoryFromActivity(profile?.activity),
    [profile?.activity]
  );

  const historyCount = historyItems.length;

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
              <div className="w-9 h-9 rounded-full bg-zinc-100" />
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-[1320px] mx-auto">
            <div className="mb-5 text-xs text-gray-600">Admin - New Applicant Detailed Page - History</div>

            {loadError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {loadError}
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#9CC3FF] overflow-hidden shadow-sm bg-[linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:34px_34px] bg-white/70">
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
                <span className="text-[11px] px-3 py-1 rounded-full bg-white/70 border border-zinc-200 text-gray-600 font-medium">
                  {loading ? "…" : statusLabel}
                </span>
              </div>

              <div className="px-6 py-4 border-b border-[#9CC3FF]/20 bg-white/30">
                <div className="flex flex-wrap gap-2">
                  {tabLink("Checklist", `/admin_recruiter/new/checklist/${applicantId}`, false)}
                  {tabLink("Profile", `/admin_recruiter/new/profile/${applicantId}`, false)}
                  {tabLink("Attachments", `/admin_recruiter/new/attachments/${applicantId}`, false)}
                  {tabLink("Skill Assessments", `/admin_recruiter/new/skill-assessments/${applicantId}`, false)}
                  {tabLink("Authorization", `/admin_recruiter/new/authorization/${applicantId}`, false)}
                  {tabLink("Activities", `/admin_recruiter/new/activities/${applicantId}`, false)}
                  {tabLink("Facility Assignments", `/admin_recruiter/new/facility-assignments/${applicantId}`, false)}
                  {tabLink("Agreement", `/admin_recruiter/new/agreement/${applicantId}`, false)}
                  {tabLink("History", `/admin_recruiter/new/history/${applicantId}`, true)}
                </div>
              </div>

              <div className="p-6 grid grid-cols-12 gap-6">
                <section className="col-span-12">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-gray-600">
                      Actions taken{" "}
                      <span className="text-gray-600">{loading ? "—" : historyCount}</span>
                    </div>
                  </div>

                  {loading ? (
                    <div className="text-sm text-gray-600 py-6">Loading history…</div>
                  ) : historyCount === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-6 py-10 text-center text-sm text-gray-600">
                      No history events yet. When a dedicated activity log is stored per worker, entries will
                      appear here. For now, record creation and profile updates are shown when timestamps are
                      available.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {historyItems.map((h) => (
                        <div
                          key={h.id}
                          className="grid grid-cols-12 gap-4 items-center border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0"
                        >
                          <div className="col-span-6 sm:col-span-7 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-teal-600/10 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-teal-700" />
                            </div>
                            <div className="text-xs text-gray-600">{h.action}</div>
                          </div>
                          <div className="col-span-6 sm:col-span-5 text-right sm:text-right">
                            <div className="text-[11px] text-gray-600">
                              {h.ago} <span className="text-gray-600">•</span> {h.date}{" "}
                              <span className="text-gray-600">•</span> {h.time}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Calendar,
  Download,
  Eye,
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

type WorkerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  status_label?: string;
};

type ProfileApi = {
  worker: WorkerProfile;
  document_urls: {
    nursing_license_url: string | null;
    tb_test_url: string | null;
    cpr_certification_url: string | null;
    ssn_url: string | null;
    ssn_back_url: string | null;
    drivers_license_url: string | null;
    drivers_license_back_url: string | null;
  };
  signeasy: { document_name: string | null; document_id: string | null };
};

type DocSlot = { label: string; url: string | null };

type DocSection = {
  id: string;
  title: string;
  slots: DocSlot[];
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function fileLabelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : "File";
  } catch {
    return "File";
  }
}

function FileActions({ url }: { url: string | null }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        disabled={!url}
        onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
        className="w-9 h-9 rounded-2xl border border-zinc-200 bg-white/80 hover:bg-white transition flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
        aria-label="View file"
      >
        <Eye className="w-4 h-4 text-teal-700" />
      </button>
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-9 h-9 rounded-2xl border border-zinc-200 bg-white/80 hover:bg-white transition flex items-center justify-center ${
          !url ? "pointer-events-none opacity-40" : ""
        }`}
        aria-label="Download file"
      >
        <Download className="w-4 h-4 text-teal-700" />
      </a>
    </div>
  );
}

export default function NewApplicantAuthorizationFilledPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileApi | null>(null);

  useEffect(() => {
    async function fetchApplicant() {
      if (!applicantId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as ProfileApi & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Failed to load profile (${res.status})`);
        }
        setProfile(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Failed to fetch applicant for authorization:", msg, e);
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

  const signeasy = profile?.signeasy;
  const du = profile?.document_urls;

  const authHasPacket = Boolean(signeasy?.document_name?.trim() || signeasy?.document_id);
  const authSigned = Boolean(signeasy?.document_id);
  const authFileLabel =
    signeasy?.document_name?.trim() || "Authorization agreement (e-sign)";

  const documentSections: DocSection[] = useMemo(() => {
    if (!du) return [];
    return [
      {
        id: "ssn",
        title: "SSN Card",
        slots: [
          { label: "Front", url: du.ssn_url },
          { label: "Back", url: du.ssn_back_url },
        ],
      },
      {
        id: "dl",
        title: "Driver's License",
        slots: [
          { label: "Front", url: du.drivers_license_url },
          { label: "Back", url: du.drivers_license_back_url },
        ],
      },
    ];
  }, [du]);

  const reviewRows = useMemo(() => {
    const rows: { id: string; title: string }[] = [
      { id: "auth", title: "Authorization" },
      { id: "ssn", title: "SSN Card" },
      { id: "dl", title: "Driver's License" },
    ];
    return rows;
  }, []);

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
            <div className="mb-5 text-xs text-gray-600">
              Admin - New Applicant Detailed Page - Authorization (filled)
            </div>

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
                  {tabLink("Authorization", `/admin_recruiter/new/authorization/${applicantId}`, true)}
                  {tabLink("Activities", `/admin_recruiter/new/activities/${applicantId}`, false)}
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
                <section className="col-span-7 space-y-6">
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-3">Authorization</div>

                    <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-gray-600">1. Authorization</div>
                        <div className="text-xs text-gray-600">
                          {authSigned ? (
                            <>
                              Signed <span className="font-medium text-gray-600">1</span> of{" "}
                              <span className="font-medium text-gray-600">1</span>
                            </>
                          ) : (
                            <>Packet {authHasPacket ? "created" : "not linked"}</>
                          )}
                        </div>
                      </div>

                      {authHasPacket ? (
                        <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-teal-700 truncate">
                              {authFileLabel}
                            </div>
                            <div className="text-[11px] text-gray-600">
                              {signeasy?.document_id
                                ? `SignEasy document id: ${signeasy.document_id}`
                                : "E-sign workflow"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {authSigned ? (
                              <span className="text-[11px] px-3 py-1 rounded-full bg-teal-600 text-white font-medium">
                                Signed
                              </span>
                            ) : (
                              <span className="text-[11px] px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-medium">
                                Pending
                              </span>
                            )}
                            <button
                              type="button"
                              disabled
                              className="w-9 h-9 rounded-2xl border border-zinc-200 bg-white/80 flex items-center justify-center opacity-40 cursor-not-allowed"
                              title="Open from SignEasy when a viewer URL is available"
                            >
                              <Eye className="w-4 h-4 text-teal-700" />
                            </button>
                            <button
                              type="button"
                              disabled
                              className="w-9 h-9 rounded-2xl border border-zinc-200 bg-white/80 flex items-center justify-center opacity-40 cursor-not-allowed"
                              title="Download when a file URL is stored"
                            >
                              <Download className="w-4 h-4 text-teal-700" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-4 py-6 text-xs text-gray-600">
                          No SignEasy authorization packet linked for this worker yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-3">Documents</div>
                    <div className="space-y-4">
                      {documentSections.map((d, idx) => {
                        const up = d.slots.filter((s) => s.url).length;
                        const tot = d.slots.length;
                        return (
                          <div
                            key={d.id}
                            className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-xs text-gray-600">
                                {idx + 2}. {d.title}
                              </div>
                              <div className="text-xs text-gray-600">
                                Uploaded{" "}
                                <span className="font-medium text-gray-600">{up}</span> of{" "}
                                <span className="font-medium text-gray-600">{tot}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              {d.slots.map((slot) => (
                                <div
                                  key={`${d.id}-${slot.label}`}
                                  className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-teal-700 truncate">
                                      {slot.url ? fileLabelFromUrl(slot.url) : `${slot.label} — not uploaded`}
                                    </div>
                                    <div className="text-[11px] text-gray-600">{slot.label}</div>
                                  </div>
                                  <FileActions url={slot.url} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="col-span-5">
                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="text-sm font-semibold text-gray-600 mb-4">Review</div>

                    <div className="space-y-6">
                      {reviewRows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="text-xs text-gray-600">{row.title}</div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <button
                              type="button"
                              className="text-xs px-4 py-2 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 transition"
                            >
                              Approved
                            </button>
                            <button
                              type="button"
                              className="text-xs px-4 py-2 rounded-2xl border border-zinc-200 bg-white/70 hover:bg-white transition"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              className="text-xs px-4 py-2 rounded-2xl border border-zinc-200 bg-white/70 hover:bg-white transition"
                            >
                              {row.id === "auth" ? "Request eSign" : "Request a doc"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
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

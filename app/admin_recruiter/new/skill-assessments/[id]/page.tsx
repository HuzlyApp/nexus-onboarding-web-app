"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import {
  Briefcase,
  Calendar,
  Download,
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
};

type WorkerProfileApi = {
  worker: WorkerProfile;
  skillAssessments: { completed: number; total: number };
};

type Assessment = {
  title: string;
  score: string;
};

export default function NewApplicantSkillAssessmentsPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applicant, setApplicant] = useState<WorkerProfile | null>(null);
  const [skillProgress, setSkillProgress] = useState<{ completed: number; total: number } | null>(
    null
  );

  useEffect(() => {
    async function fetchApplicant() {
      if (!applicantId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as WorkerProfileApi & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Failed to load profile (${res.status})`);
        }
        const w = json.worker;
        setApplicant({
          id: w.id,
          first_name: w.first_name,
          last_name: w.last_name,
          job_role: w.job_role,
        });
        setSkillProgress(json.skillAssessments ?? null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Failed to fetch applicant for skill assessments:", msg, e);
        setLoadError(msg);
        setApplicant(null);
        setSkillProgress(null);
      } finally {
        setLoading(false);
      }
    }

    fetchApplicant();
  }, [applicantId]);

  const candidateName = useMemo(() => {
    const n = `${applicant?.first_name ?? ""} ${applicant?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [applicant]);

  const candidateRole = applicant?.job_role || "N/A";

  const assessments: Assessment[] = useMemo(
    () => [
      { title: "Basic Patient Care & Hygiene", score: "10 of 10" },
      { title: "Clinical Skills & Procedures", score: "4 of 10" },
      { title: "Assessment, Monitoring & Emergency Response", score: "10 of 10" },
      { title: "Mobility Positioning & Patient Handling", score: "7 of 10" },
      { title: "Clinical Skills & Procedures", score: "5 of 10" },
      { title: "Professional Practices & Documentation", score: "9 of 10" },
    ],
    []
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
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden text-gray-600"
            >
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
              Admin - New Applicant Detailed Page - Skill Assessments
            </div>

            {loadError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {loadError}
              </div>
            ) : null}

            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              loading={loading}
            />
            <DetailedTabs applicantId={applicantId} activeTab="Skill Assessments" />

            <div className="mx-auto w-full max-w-[1300px]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[20px] font-semibold leading-7 text-[#1F2937]">Skill Assessment</h2>
                <div className="text-xs font-medium text-[#6B7280]">
                  Completed{" "}
                  <span className="font-semibold text-[#111827]">
                    {skillProgress && skillProgress.total > 0
                      ? `${skillProgress.completed} of ${skillProgress.total}`
                      : "0 of 0"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {assessments.map((a) => (
                  <div
                    key={a.title + a.score}
                    className="flex h-[84px] w-full items-center justify-between gap-5 rounded-[8px] border border-[#99D8D3] bg-[#ECF4F3] px-4 py-5"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <img
                        src="/icons/admin-recruiter/Stepper indicator.svg"
                        alt=""
                        className="h-8 w-8 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[16px] font-semibold leading-6 text-[#1F2937]">{a.title}</div>
                        <div className="mt-1 text-[14px] leading-5 text-[#475467]">{a.score}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button className="inline-flex h-10 items-center justify-center rounded-lg border border-[#0D9488] px-6 text-sm font-semibold text-[#0D9488]">
                        See Results
                      </button>
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#0D9488] px-4 text-sm font-semibold text-[#0D9488]">
                        <img src="/icons/pdf-icon.svg" alt="" className="h-5 w-5" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#0D9488] px-6 text-sm font-semibold text-[#0D9488]">
                  <img src="/icons/pdf-icon.svg" alt="" className="h-4 w-4" />
                  Download skill assessment full results
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronRight,
  Columns2,
  LogOut,
  Settings,
  Users,
} from "lucide-react";

const CANDIDATE_SUB = [
  { label: "All", href: "/admin_recruiter/candidates" },
  { label: "New", href: "/admin_recruiter/new" },
  { label: "Pending", href: "/admin_recruiter/pending" },
  { label: "Approved", href: "/admin_recruiter/approved" },
  { label: "Disapproved", href: "/admin_recruiter/disapproved" },
] as const;

const WORKER_SUB = [
  { label: "Active", href: "/admin_recruiter/workers" },
  { label: "Inactive", href: "/admin_recruiter/workers" },
  { label: "Cancelled", href: "/admin_recruiter/workers" },
  { label: "Banned", href: "/admin_recruiter/workers" },
] as const;

export function AdminRecruiterSidebar() {
  const pathname = usePathname() ?? "";
  const [candidatesGroupOpen, setCandidatesGroupOpen] = useState(true);
  const [workersGroupOpen, setWorkersGroupOpen] = useState(true);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] bg-[#e9f2f0] lg:block">
      <div className="relative h-full">
        <div className="absolute inset-y-0 left-0 w-12 bg-[#033c3a] text-[#d4efea] flex flex-col items-center py-4 gap-5">
          <div className="h-8 w-8 rounded-md bg-[#0b5f5a] text-white text-xs font-bold flex items-center justify-center">
            N
          </div>
          <Users className="h-4 w-4" />
          <Columns2 className="h-4 w-4" />
          <Settings className="h-4 w-4" />
          <Calendar className="h-4 w-4" />
          <Briefcase className="h-4 w-4" />
          <Bell className="h-4 w-4" />
          <LogOut className="h-4 w-4 mt-auto mb-2" />
        </div>

        <div className="ml-12 h-full flex flex-col">
          <div className="px-4 py-6">
            <p className="text-[10px] font-semibold tracking-wide text-[#587573]">TEAM MANAGEMENT</p>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="rounded-xl bg-transparent overflow-hidden">
              <button
                type="button"
                onClick={() => setCandidatesGroupOpen((v) => !v)}
                className="flex w-full items-center justify-between px-2 py-2 text-sm font-semibold text-[#1b5f5b]"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0" />
                  Candidates
                </span>
                {candidatesGroupOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {candidatesGroupOpen ? (
                <div className="mt-1 space-y-0.5">
                  {CANDIDATE_SUB.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block rounded-md px-2 py-1.5 text-xs transition ${
                          active ? "border border-[#88b3ad] bg-[#f5fbfa] text-[#0f514e]" : "text-[#3e5d5a] hover:bg-[#f2f8f7]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="mt-6 pt-4">
              <button
                type="button"
                onClick={() => setWorkersGroupOpen((v) => !v)}
                className="flex w-full items-center justify-between px-2 py-2 text-sm font-semibold text-[#1b5f5b]"
              >
                <span className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 shrink-0" />
                  Workers
                </span>
                {workersGroupOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {workersGroupOpen ? (
                <div className="mt-1 space-y-0.5">
                  {WORKER_SUB.map((item) => {
                    const onWorkers = pathname.startsWith("/admin_recruiter/workers");
                    const active = onWorkers && item.label === "Active";
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`block rounded-md px-2 py-1.5 text-xs transition ${
                          active ? "border border-[#88b3ad] bg-[#f5fbfa] text-[#0f514e]" : "text-[#3e5d5a] hover:bg-[#f2f8f7]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </nav>
        </div>
      </div>
    </aside>
  );
}

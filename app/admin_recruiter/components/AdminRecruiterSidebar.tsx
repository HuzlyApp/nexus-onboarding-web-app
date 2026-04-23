"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronRight,
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
  const inDashboard = pathname.startsWith("/admin_recruiter/dashboard");
  const inCandidates = pathname.startsWith("/admin_recruiter/candidates") || pathname.startsWith("/admin_recruiter/new") || pathname.startsWith("/admin_recruiter/pending") || pathname.startsWith("/admin_recruiter/approved") || pathname.startsWith("/admin_recruiter/disapproved");
  const inWorkers = pathname.startsWith("/admin_recruiter/workers");

  type RailIcon = {
    src: string;
    alt: string;
    active: boolean;
    href?: string;
  };

  const railIcons: RailIcon[] = [
    { src: "/icons/admin-recruiter/dashboard-icon.svg", alt: "Dashboard", active: inDashboard, href: "/admin_recruiter/dashboard" },
    { src: "/icons/admin-recruiter/user-setting.svg", alt: "User setting", active: false },
    { src: "/icons/admin-recruiter/groups.svg", alt: "Groups", active: inCandidates || inWorkers },
    { src: "/icons/admin-recruiter/calender.svg", alt: "Calendar", active: false },
    { src: "/icons/admin-recruiter/switch-icon.svg", alt: "Switch", active: false },
    { src: "/icons/admin-recruiter/bell-02.svg", alt: "Notification", active: false },
    { src: "/icons/admin-recruiter/circle-focus.svg", alt: "Circle focus", active: false },
    { src: "/icons/admin-recruiter/setting.svg", alt: "Setting", active: false },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[344px] max-w-[344px] min-w-[80px] border-r border-[#d7e4e1] bg-[#e9f2f0] lg:block">
      <div className="relative h-full">
        <div className="absolute inset-y-0 left-0 w-20 bg-[#033c3a] text-[#d4efea] flex flex-col items-center py-3 pb-5">
          <div className="mt-1 mb-6">
            <Image
              src="/icons/admin-recruiter/nexus-main-logo.svg"
              alt="Nexus logo"
              width={46}
              height={46}
              className="w-[46px] h-[46px]"
            />
          </div>

          <div className="flex flex-col items-center">
            {railIcons.map((icon) => {
              const cls = `h-[72px] w-20 flex items-center justify-center cursor-pointer transition ${
                icon.active ? "bg-[#0b5551] shadow-[inset_3px_0_0_0_#14d3c2]" : "hover:bg-[#044543]"
              }`;

              if (icon.href) {
                return (
                  <Link key={icon.src} href={icon.href} className={cls} aria-label={icon.alt}>
                    <Image src={icon.src} alt={icon.alt} width={32} height={32} />
                  </Link>
                );
              }

              return (
                <div key={icon.src} className={cls}>
                  <Image src={icon.src} alt={icon.alt} width={32} height={32} />
                </div>
              );
            })}
          </div>

          <div className="mt-auto h-[72px] w-20 flex items-center justify-center cursor-pointer transition hover:bg-[#044543]">
            <Image src="/icons/admin-recruiter/logout.svg" alt="Logout" width={32} height={32} />
          </div>
        </div>

        <div className="ml-20 h-full w-[264px] flex flex-col">
          <div className="px-5 pt-10 pb-5">
            <p className="text-xs font-semibold leading-[18px] uppercase tracking-normal text-[#587573]">TEAM MANAGEMENT</p>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 pb-5">
            <div className="w-56 rounded-xl bg-transparent overflow-hidden">
              <button
                type="button"
                onClick={() => setCandidatesGroupOpen((v) => !v)}
                className="flex w-full items-center justify-between px-2 py-2 text-sm font-semibold text-[#1b5f5b]"
              >
                <span className="flex items-center gap-2">
                  <Image src="/icons/admin-recruiter/Member.svg" alt="" width={18} height={18} className="shrink-0" />
                  Candidates
                </span>
                {candidatesGroupOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {candidatesGroupOpen ? (
                <div className="mt-1 space-y-0">
                  {CANDIDATE_SUB.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex h-8 w-56 items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
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

            <div className="mt-6 w-56 border-t border-[#d6e2df] pt-6">
              <button
                type="button"
                onClick={() => setWorkersGroupOpen((v) => !v)}
                className="flex w-full items-center justify-between px-2 py-2 text-sm font-semibold text-[#1b5f5b]"
              >
                <span className="flex items-center gap-2">
                  <Image src="/icons/admin-recruiter/Member.svg" alt="" width={18} height={18} className="shrink-0" />
                  Workers
                </span>
                {workersGroupOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {workersGroupOpen ? (
                <div className="mt-1 flex h-[128px] w-56 flex-col gap-3">
                  {WORKER_SUB.map((item) => {
                    const onWorkers = pathname.startsWith("/admin_recruiter/workers");
                    const active = onWorkers && item.label === "Active";
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`flex h-8 w-56 items-center rounded-md px-2 py-1.5 text-xs transition ${
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

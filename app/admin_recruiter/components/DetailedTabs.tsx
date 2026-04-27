"use client";

import Link from "next/link";

type DetailedTabsProps = {
  applicantId?: string;
  activeTab:
    | "Checklist"
    | "Profile"
    | "Attachments"
    | "Skill Assessments"
    | "Authorization"
    | "Activities"
    | "Facility Assignments"
    | "Agreement"
    | "History";
};

const TABS = [
  "Checklist",
  "Profile",
  "Attachments",
  "Skill Assessments",
  "Authorization",
  "Activities",
  "Facility Assignments",
  "Agreement",
  "History",
] as const;

function tabHref(tab: (typeof TABS)[number], applicantId?: string) {
  const id = applicantId ?? "";
  switch (tab) {
    case "Checklist":
      return `/admin_recruiter/new/checklist/${id}`;
    case "Profile":
      return `/admin_recruiter/new/profile/${id}`;
    case "Attachments":
      return `/admin_recruiter/new/attachments/${id}`;
    case "Skill Assessments":
      return `/admin_recruiter/new/skill-assessments/${id}`;
    case "Authorization":
      return `/admin_recruiter/new/authorization/${id}`;
    case "Activities":
      return `/admin_recruiter/new/activities/${id}`;
    case "Facility Assignments":
      return `/admin_recruiter/new/facility-assignments/${id}`;
    case "Agreement":
      return `/admin_recruiter/new/agreement/${id}`;
    case "History":
      return `/admin_recruiter/new/history/${id}`;
    default:
      return "#";
  }
}

export default function DetailedTabs({ applicantId, activeTab }: DetailedTabsProps) {
  return (
    <div className="mb-4">
      <div className="mx-auto w-full max-w-[1300px] rounded-lg   p-1">
        <div className="flex h-[36px] items-center gap-4 overflow-hidden">
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <Link
                key={tab}
                href={tabHref(tab, applicantId)}
                className={`inline-flex h-full shrink-0 items-center justify-center rounded-lg px-4 text-center text-sm font-normal leading-5 whitespace-nowrap transition ${
                  isActive
                    ? "bg-[#0D9488] text-white"
                    : "text-[#374151] hover:bg-[#F3F4F6]"
                }`}
              >
                {tab}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

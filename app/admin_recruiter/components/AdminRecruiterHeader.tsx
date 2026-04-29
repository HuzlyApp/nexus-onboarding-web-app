"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";

export function AdminRecruiterHeader() {
  const router = useRouter();
  const [headerName, setHeaderName] = useState("User");
  const [headerRole, setHeaderRole] = useState("Staff");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const json = (await res.json()) as { displayName?: string; role?: string };
        if (!res.ok || cancelled) return;
        if (typeof json.displayName === "string" && json.displayName.trim()) {
          setHeaderName(json.displayName.trim());
        }
        if (typeof json.role === "string" && json.role.trim()) {
          const role = json.role.trim();
          setHeaderRole(role.charAt(0).toUpperCase() + role.slice(1));
        }
      } catch {
        // Keep generic labels in non-auth contexts.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E2E8F0]">
      <div className="flex h-[68px] w-full items-center justify-between px-5 py-4 lg:px-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#E2E8F0] text-[#64748B] transition hover:bg-[#CBD5E1]"
          aria-label="Go back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img
              src={`https://i.pravatar.cc/128?u=${encodeURIComponent(headerName)}`}
              alt={headerName}
              width={30}
              height={30}
              className="h-[30px] w-[30px] rounded-full object-cover"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-[#0F172A]">{headerName}</p>
              <p className="text-[11px] text-[#64748B]">{headerRole}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-slate-100"
              aria-label="Open profile menu"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-slate-100"
              aria-label="Chat"
            >
              <Image src="/icons/admin-recruiter/chat.svg" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Image src="/icons/admin-recruiter/bell-02.svg" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

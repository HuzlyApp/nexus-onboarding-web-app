"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminRecruiterSidebar } from "./components/AdminRecruiterSidebar";
import { AdminRecruiterHeader } from "./components/AdminRecruiterHeader";
import "./layout.css";

/**
 * Default body copy color for recruiter admin; pages still set explicit colors
 * (e.g. sidebar `text-white`, links `text-teal-*`) where needed.
 */
export default function AdminRecruiterLayout({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="admin-recruiter-shell min-h-screen bg-[#f3f5f5] text-gray-600">
      <AdminRecruiterSidebar isMobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <div className="admin-recruiter-content lg:pl-[344px]">
        <AdminRecruiterHeader onMenuClick={() => setMobileSidebarOpen(true)} />
        {children}
      </div>
    </div>
  );
}

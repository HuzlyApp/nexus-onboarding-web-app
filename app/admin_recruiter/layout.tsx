import type { ReactNode } from "react";
import { AdminRecruiterSidebar } from "./components/AdminRecruiterSidebar";
import { AdminRecruiterHeader } from "./components/AdminRecruiterHeader";
import "./layout.css";

/**
 * Default body copy color for recruiter admin; pages still set explicit colors
 * (e.g. sidebar `text-white`, links `text-teal-*`) where needed.
 */
export default function AdminRecruiterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-recruiter-shell min-h-screen bg-[#f3f5f5] text-gray-600">
      <AdminRecruiterSidebar />
      <div className="admin-recruiter-content lg:pl-[248px]">
        <AdminRecruiterHeader />
        {children}
      </div>
    </div>
  );
}

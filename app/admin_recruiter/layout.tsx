import type { ReactNode } from "react";

/**
 * Default body copy color for recruiter admin; pages still set explicit colors
 * (e.g. sidebar `text-white`, links `text-teal-*`) where needed.
 */
export default function AdminRecruiterLayout({ children }: { children: ReactNode }) {
  return <div className="text-gray-600">{children}</div>;
}

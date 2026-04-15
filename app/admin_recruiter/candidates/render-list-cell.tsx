import type { ReactNode } from "react"
import type { CandidateColumnId } from "./column-config"
import type { CandidateRow } from "./types"

export function renderListCell(
  col: CandidateColumnId,
  c: CandidateRow,
  formatDate: (iso: string | null) => string
): ReactNode {
  switch (col) {
    case "name":
      return <div className="font-medium text-gray-600">{c.name}</div>
    case "status":
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {c.status}
        </span>
      )
    case "reference":
      return <span className="text-sm text-gray-600">{c.reference}</span>
    case "jobRole":
      return <span className="text-sm text-gray-600">{c.role}</span>
    case "createdDate":
      return <span className="text-sm text-gray-600">{formatDate(c.createdAt)}</span>
    case "location":
      return <span className="text-sm text-gray-600">{c.address || "—"}</span>
    case "city":
      return <span className="text-sm text-gray-600">{c.city || "—"}</span>
    case "zipCode":
      return <span className="text-sm text-gray-600">{c.zip || "—"}</span>
    case "state":
      return <span className="text-sm text-gray-600">{c.state || "—"}</span>
    case "address1":
      return <span className="text-sm text-gray-600">{c.address1 || "—"}</span>
    case "phone":
      return <span className="text-sm text-gray-600">{c.phone || "—"}</span>
    case "email":
      return <span className="text-sm text-gray-600">{c.email || "—"}</span>
    case "dateOfBirth":
      return <span className="text-sm text-gray-600">{c.dateOfBirth ? formatDate(c.dateOfBirth) : "—"}</span>
    case "firstName":
      return <span className="text-sm text-gray-600">{c.firstName || "—"}</span>
    case "lastName":
      return <span className="text-sm text-gray-600">{c.lastName || "—"}</span>
    default:
      return <span className="text-sm text-gray-600">—</span>
  }
}

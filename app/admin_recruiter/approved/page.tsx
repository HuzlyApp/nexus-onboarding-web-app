"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Calendar,
  Filter,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
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
  created_at: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  status?: string | null;
};

type CandidateRow = {
  id: string;
  name: string;
  role: string;
  createdAt: string | null;
  location: string;
  reference: string;
  status: string;
};

const sidebarItems = [
  { label: "Candidates", href: "/admin_recruiter/candidates", icon: Users },
  { label: "All", href: "/admin_recruiter/candidates", icon: Users },
  { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
  { label: "Pending", href: "/admin_recruiter/pending", icon: UserCheck },
  { label: "Approved", href: "/admin_recruiter/approved", icon: UserCheck },
  { label: "Disapproved", href: "/admin_recruiter/disapproved", icon: UserX },
  { label: "Workers", href: "/admin_recruiter/workers", icon: Briefcase },
  { label: "Schedule", href: "/admin_recruiter/schedule", icon: Calendar },
] as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function titleCaseStatus(s: string) {
  const v = (s || "").trim();
  if (!v) return "—";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
}

export default function ApprovedCandidatesPage() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function fetchApproved() {
      setLoading(true);
      try {
        const res = await fetch("/api/workers?status=approved");
        const json = (await res.json().catch(() => ({}))) as {
          workers?: WorkerProfile[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load workers");
        const data = Array.isArray(json.workers) ? json.workers : [];

        const mapped: CandidateRow[] = (data ?? []).map((p) => {
          const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unnamed";
          const location = [p.city, p.state].filter(Boolean).join(", ") || "—";
          return {
            id: p.id,
            name,
            role: p.job_role || "N/A",
            createdAt: p.created_at,
            location,
            reference: p.id.slice(0, 6).toUpperCase(),
            status: titleCaseStatus(p.status ?? "approved"),
          };
        });

        setRows(mapped);
      } catch (e) {
        console.error("Failed to fetch approved candidates:", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    fetchApproved();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
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

            {sidebarItems.map((item) => {
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
            <button onClick={() => setSidebarOpen((v) => !v)} className="lg:hidden text-gray-600">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="font-semibold text-2xl">Candidates</div>
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
          <div className="text-xs text-gray-600 mb-3">Admin - Approved Applicant Listings</div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-semibold">Candidates</h1>
              <p className="text-gray-600">Manage applicants in one place</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-2xl transition">
                <Plus className="w-5 h-5" /> Create Candidate
              </button>

              <div className="flex items-center bg-white border border-zinc-200 rounded-2xl px-5 py-3">
                <Search className="w-5 h-5 text-gray-600 mr-3" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search worker or candidate"
                  className="bg-transparent outline-none flex-1 min-w-[220px]"
                />
              </div>

              <button className="flex items-center gap-2 border border-zinc-200 hover:bg-zinc-50 px-6 py-3 rounded-2xl transition">
                <Filter className="w-5 h-5" /> Filters
              </button>

              <button className="flex items-center gap-2 border border-zinc-200 hover:bg-zinc-50 px-6 py-3 rounded-2xl transition">
                <RefreshCw className="w-5 h-5" /> Refresh
              </button>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-gray-600">
                  Total: <span className="font-medium text-gray-600">{filtered.length}</span>{" "}
                  applicants
                </div>
                <div className="h-5 w-px bg-zinc-200 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Type</span>
                  <button className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                    Candidates
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Status</span>
                  <button className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                    Approved
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Job Role</span>
                  <button className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                    All
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Location</span>
                  <button className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                    All
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                  List View
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-600">Loading approved applicants...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-600">No approved applicants found.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[980px] w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-widest text-gray-600 border-b border-zinc-100">
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-4 py-4 font-medium">Status</th>
                      <th className="px-4 py-4 font-medium">Reference</th>
                      <th className="px-4 py-4 font-medium">Job Role</th>
                      <th className="px-4 py-4 font-medium">Created Date</th>
                      <th className="px-6 py-4 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-semibold">
                              {initials(r.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-600 truncate">{r.name}</div>
                              <div className="text-xs text-gray-600">Candidates</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{r.reference}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{r.role}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{formatDate(r.createdAt)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


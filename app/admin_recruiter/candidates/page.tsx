// app/admin_recruiter/candidates/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  Briefcase,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Columns2,
  ChevronDown,
  ChevronRight,
  FileText,
  Eye,
  MoreHorizontal,
  Loader2,
  Bell,
  MessageCircle,
} from "lucide-react";
import { EditColumnsModal } from "./EditColumnsModal";
import {
  columnLabel,
  DEFAULT_CANDIDATE_COLUMNS,
  loadColumnOrder,
  saveColumnOrder,
  type CandidateColumnId,
} from "./column-config";
import { renderListCell } from "./render-list-cell";
import type { CandidateRow } from "./types";

type WorkerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2?: string | null;
  city: string | null;
  state: string | null;
  zip?: string | null;
  created_at: string | null;
  status?: string | null;
};

const STATUS_FILTER = ["All", "New", "Pending", "Approved", "Disapproved"] as const;
type StatusFilter = (typeof STATUS_FILTER)[number];

function titleCaseStatus(s: string | null | undefined) {
  const v = (s || "").trim();
  if (!v) return "New";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
}

function statusToApiParam(s: StatusFilter): string | null {
  if (s === "All") return null;
  return s.toLowerCase();
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

/** Fixed `en-US` locale so SSR and browser produce identical strings (avoids hydration mismatch). */
function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} • ${time}`;
}

function formatDateShort(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const CANDIDATE_SUB = [
  { label: "All", href: "/admin_recruiter/candidates", icon: Users },
  { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
  { label: "Pending", href: "/admin_recruiter/pending", icon: UserCheck },
  { label: "Approved", href: "/admin_recruiter/approved", icon: UserCheck },
  { label: "Disapproved", href: "/admin_recruiter/disapproved", icon: UserX },
] as const;

const WORKER_SUB = [
  { label: "Active", href: "/admin_recruiter/workers" },
  { label: "Inactive", href: "/admin_recruiter/workers" },
  { label: "Cancelled", href: "/admin_recruiter/workers" },
  { label: "Banned", href: "/admin_recruiter/workers" },
] as const;

const PAGE_SIZE = 9;

export default function CandidatesPage() {
  const pathname = usePathname();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [candidatesGroupOpen, setCandidatesGroupOpen] = useState(true);
  const [workersGroupOpen, setWorkersGroupOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter] = useState("Candidates");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [view, setView] = useState<"card" | "list">("card");
  const [listColumnOrder, setListColumnOrder] = useState<CandidateColumnId[]>(DEFAULT_CANDIDATE_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    setListColumnOrder(loadColumnOrder());
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const param = statusToApiParam(statusFilter);
      const url = param ? `/api/workers?status=${encodeURIComponent(param)}` : "/api/workers";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch workers");

      const rows: WorkerProfile[] = Array.isArray(data?.workers)
        ? data.workers
        : Array.isArray(data)
          ? data
          : [];
      setTotalFromApi(typeof data?.total === "number" ? data.total : rows.length);

      const mapped: CandidateRow[] = rows.map((item) => ({
        id: item.id,
        name: `${item.first_name || ""} ${item.last_name || ""}`.trim(),
        firstName: item.first_name ?? "",
        lastName: item.last_name ?? "",
        role: item.job_role || "N/A",
        email: item.email || "",
        phone: item.phone || "",
        address: [item.address1, item.city, item.state].filter(Boolean).join(", "),
        city: item.city ?? "",
        state: item.state ?? "",
        zip: item.zip ?? "",
        address1: item.address1 ?? "",
        address2: item.address2 ?? "",
        status: titleCaseStatus(item.status as string | undefined),
        createdAt: item.created_at,
        reference: item.id.slice(0, 7).toUpperCase(),
        dateOfBirth: null,
      }));

      setCandidates(mapped);
      setVisibleCount(PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch workers:", err);
      setCandidates([]);
      setTotalFromApi(null);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const jobRoleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of candidates) {
      if (c.role && c.role !== "N/A") s.add(c.role);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const locationOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of candidates) {
      const loc = [c.city, c.state].filter(Boolean).join(", ");
      if (loc) s.add(loc);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const filtered = useMemo(() => {
    let out = candidates;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.reference.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.zip.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q)
        );
      });
    }
    if (jobRoleFilter) out = out.filter((c) => c.role === jobRoleFilter);
    if (locationFilter) {
      out = out.filter((c) => [c.city, c.state].filter(Boolean).join(", ") === locationFilter);
    }
    return out;
  }, [candidates, query, jobRoleFilter, locationFilter]);

  const visibleCards = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const totalLabel = useMemo(() => {
    if (statusFilter === "All") return "applicants";
    return `${statusFilter} applicants`;
  }, [statusFilter]);

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
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

          <nav className="flex-1 px-3 py-8 space-y-1 overflow-y-auto">
            <div className="px-4 text-xs uppercase tracking-widest text-teal-400/70 mb-4">PERSONAL SETTINGS</div>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
              Profile
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
              Account
            </a>

            <div className="px-4 pt-8 text-xs uppercase tracking-widest text-teal-400/70 mb-2">TEAM MANAGEMENT</div>

            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setCandidatesGroupOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-white/95 hover:bg-white/10"
              >
                <span className="flex items-center gap-3">
                  <Users className="w-5 h-5 shrink-0" />
                  Candidates
                </span>
                {candidatesGroupOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {candidatesGroupOpen ? (
                <div className="pb-2 pl-2 pr-2 space-y-0.5">
                  {CANDIDATE_SUB.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 pl-10 pr-4 py-2.5 text-sm rounded-xl transition-all ${
                          active
                            ? "border border-teal-400/80 bg-teal-500/15 text-white"
                            : "text-white/75 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="w-4 h-4 opacity-90" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setWorkersGroupOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-white/95 hover:bg-white/10"
              >
                <span className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 shrink-0" />
                  Workers
                </span>
                {workersGroupOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {workersGroupOpen ? (
                <div className="pb-2 pl-2 pr-2 space-y-0.5">
                  {WORKER_SUB.map((item) => {
                    const onWorkers = pathname.startsWith("/admin_recruiter/workers");
                    const active = onWorkers && item.label === "Active";
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`flex items-center gap-3 pl-10 pr-4 py-2.5 text-sm rounded-xl transition-all ${
                          active
                            ? "border border-teal-400/80 bg-teal-500/15 text-white"
                            : "text-white/75 hover:bg-white/10"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <Link
              href="/admin_recruiter/schedule"
              className={`mt-2 flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all ${
                pathname === "/admin_recruiter/schedule"
                  ? "bg-white/10 text-white"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              <Calendar className="w-5 h-5" />
              Schedule
            </Link>

            <div className="px-4 pt-6">
              <a href="#" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl">
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

      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-600">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="font-semibold text-2xl">Candidates</div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Online
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <button type="button" className="p-2 rounded-xl hover:bg-zinc-100" aria-label="Messages">
                <MessageCircle className="w-5 h-5" />
              </button>
              <button type="button" className="p-2 rounded-xl hover:bg-zinc-100" aria-label="Notifications">
                <Bell className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden xs:block">
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

        <div className="flex-1 p-6 sm:p-8 overflow-auto">
          <div className="text-xs text-gray-600 mb-3">Admin - Candidate Listings</div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-semibold text-gray-600">Candidates</h1>
              <p className="text-gray-600 mt-1">Manage applicants in one place</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                type="button"
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 sm:px-6 py-3 rounded-2xl transition shadow-sm"
              >
                <Plus className="w-5 h-5" /> Create Candidate
              </button>

              <div className="flex items-center bg-white border border-zinc-200 rounded-2xl px-4 sm:px-5 py-3 min-w-0 flex-1 sm:flex-initial sm:min-w-[240px]">
                <Search className="w-5 h-5 text-gray-600 mr-3 shrink-0" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search worker or candidate"
                  className="bg-transparent outline-none flex-1 min-w-0 text-sm"
                />
              </div>

              <button
                type="button"
                className="flex items-center gap-2 border border-zinc-200 bg-white hover:bg-zinc-50 px-5 py-3 rounded-2xl transition"
              >
                <Filter className="w-5 h-5" /> Filters
              </button>

              <button
                type="button"
                onClick={() => void loadCandidates()}
                className="flex items-center gap-2 border border-zinc-200 bg-white hover:bg-zinc-50 px-5 py-3 rounded-2xl transition"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  className="flex items-center justify-center w-12 h-12 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-2xl transition"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="w-5 h-5 text-gray-600" />
                </button>
                {moreMenuOpen ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      aria-label="Close menu"
                      onClick={() => setMoreMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl border border-zinc-200 bg-white py-2 shadow-lg">
                      <Link
                        href="/admin_recruiter/advanced-search"
                        className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-zinc-50"
                        onClick={() => setMoreMenuOpen(false)}
                      >
                        Advanced search
                      </Link>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <label className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 whitespace-nowrap">Type</span>
                  <select
                    value={typeFilter}
                    disabled
                    className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-gray-600 max-w-[140px]"
                  >
                    <option>Candidates</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 whitespace-nowrap">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 max-w-[140px]"
                  >
                    {STATUS_FILTER.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 whitespace-nowrap">Job Role</span>
                  <select
                    value={jobRoleFilter}
                    onChange={(e) => setJobRoleFilter(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 max-w-[160px]"
                  >
                    <option value="">All</option>
                    {jobRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 whitespace-nowrap">Location</span>
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 max-w-[180px]"
                  >
                    <option value="">All</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 bg-zinc-50/50">
              <div className="text-sm text-gray-600">
                Total:{" "}
                <span className="font-semibold text-gray-600">
                  {loading ? "—" : totalFromApi ?? filtered.length}
                </span>{" "}
                {loading ? "" : totalLabel}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-medium ${view === "card" ? "text-teal-700" : "text-gray-600"}`}>
                  Card View
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={view === "list"}
                  aria-label="Toggle list view"
                  onClick={() => setView((v) => (v === "card" ? "list" : "card"))}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                    view === "list" ? "bg-teal-600" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      view === "list" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className={`text-xs font-medium ${view === "list" ? "text-teal-700" : "text-gray-600"}`}>
                  List View
                </span>
                {view === "list" ? (
                  <button
                    type="button"
                    onClick={() => setEditColumnsOpen(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-zinc-50"
                  >
                    <Columns2 className="h-4 w-4" />
                    Edit columns
                  </button>
                ) : null}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {(() => {
                const formatDate = formatDateShort;

                if (loading) {
                  return (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                      Loading candidates…
                    </div>
                  );
                }
                if (filtered.length === 0) {
                  return <div className="text-center py-24 text-gray-600">No candidates found.</div>;
                }

                if (view === "list") {
                  const cols = listColumnOrder.length ? listColumnOrder : DEFAULT_CANDIDATE_COLUMNS;
                  return (
                    <div className="bg-zinc-50/80 border border-zinc-200 rounded-2xl overflow-hidden">
                      <div className="overflow-auto">
                        <table className="min-w-[720px] w-full bg-white">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-widest text-gray-600 border-b border-zinc-100">
                              {cols.map((colId) => (
                                <th key={colId} className="px-4 py-4 font-medium first:pl-6 last:pr-6">
                                  {columnLabel(colId)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((c) => (
                              <tr key={c.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                                {cols.map((colId) => (
                                  <td key={colId} className="px-4 py-4 first:pl-6 last:pr-6 align-top">
                                    {renderListCell(colId, c, formatDate)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                      {visibleCards.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 hover:shadow-md hover:border-teal-200/60 transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                                {initialsFromName(c.name || "NA")}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-600 truncate text-[15px]">{c.name || "Unnamed"}</div>
                                <div className="text-[11px] text-gray-600 mt-0.5">RN #{c.reference}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Link
                                href={`/admin_recruiter/new/attachments/${c.id}`}
                                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-teal-50 hover:border-teal-200 flex items-center justify-center text-gray-600 hover:text-teal-800 transition"
                                aria-label="View document"
                              >
                                <FileText className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/admin_recruiter/new/profile/${c.id}`}
                                className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-teal-50 hover:border-teal-200 flex items-center justify-center text-gray-600 hover:text-teal-800 transition"
                                aria-label="View profile"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <CalendarDays className="w-4 h-4 text-teal-600 shrink-0" />
                              <span>{formatDateTime(c.createdAt)}</span>
                            </div>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border-2 border-teal-600 text-teal-800 bg-white">
                              {c.status}
                            </span>
                          </div>

                          <div className="mt-5 space-y-2.5 text-xs text-gray-600">
                            <div className="flex items-start gap-2.5">
                              <Mail className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                              <span className="truncate">{c.email || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <Phone className="w-4 h-4 text-teal-600 shrink-0" />
                              <span className="truncate">{c.phone || "—"}</span>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">{c.address || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {visibleCount < filtered.length ? (
                      <div className="flex justify-center mt-10 pb-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLoadMoreLoading(true);
                            setTimeout(() => {
                              setVisibleCount((n) => n + PAGE_SIZE);
                              setLoadMoreLoading(false);
                            }, 400);
                          }}
                          disabled={loadMoreLoading}
                          className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl border-2 border-zinc-200 bg-white text-sm font-medium text-gray-600 hover:bg-zinc-50 hover:border-teal-300 transition disabled:opacity-60"
                        >
                          {loadMoreLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                          ) : null}
                          Load more
                        </button>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <EditColumnsModal
        key={editColumnsOpen ? "edit-cols-open" : "edit-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        value={listColumnOrder}
        onSave={(order) => {
          setListColumnOrder(order);
          saveColumnOrder(order);
        }}
      />
    </div>
  );
}

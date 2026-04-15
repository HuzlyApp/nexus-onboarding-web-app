"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Calendar,
  Filter,
  GripVertical,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
  ChevronUp,
  ChevronDown,
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

export default function NewCandidatesPage() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [jobRoleFilter, setJobRoleFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");

  type ColumnKey = "name" | "status" | "reference" | "role" | "createdAt" | "location" | "checklist";
  const allColumns = useMemo(
    () =>
      [
        { key: "name" as const, label: "Name" },
        { key: "status" as const, label: "Status" },
        { key: "reference" as const, label: "Reference" },
        { key: "role" as const, label: "Job Role" },
        { key: "createdAt" as const, label: "Created Date" },
        { key: "location" as const, label: "Location" },
        { key: "checklist" as const, label: "Checklist" },
      ] as const,
    []
  );

  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [columnsOrder, setColumnsOrder] = useState<ColumnKey[]>(
    allColumns.map((c) => c.key)
  );
  const [columnsVisible, setColumnsVisible] = useState<Record<ColumnKey, boolean>>({
    name: true,
    status: true,
    reference: true,
    role: true,
    createdAt: true,
    location: true,
    checklist: true,
  });

  const [draftSearch, setDraftSearch] = useState("");
  const [draftOrder, setDraftOrder] = useState<ColumnKey[]>(columnsOrder);
  const [draftVisible, setDraftVisible] = useState<Record<ColumnKey, boolean>>(columnsVisible);

  async function loadNewApplicants() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/workers?worker_status=new", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        workers?: WorkerProfile[];
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load workers");
      const data = Array.isArray(json.workers) ? json.workers : [];
      setTotalFromApi(typeof json.total === "number" ? json.total : data.length);

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
          status: titleCaseStatus(p.status ?? "new"),
        };
      });

      setRows(mapped);
    } catch (e) {
      console.error("Failed to fetch new candidates:", e);
      setFetchError(e instanceof Error ? e.message : "Failed to load applicants");
      setRows([]);
      setTotalFromApi(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNewApplicants();
  }, []);

  const jobRoleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.role && r.role !== "N/A") s.add(r.role);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const locationOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.location && r.location !== "—") s.add(r.location);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        return (
          r.name.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q)
        );
      });
    }
    if (jobRoleFilter) {
      out = out.filter((r) => r.role === jobRoleFilter);
    }
    if (locationFilter) {
      out = out.filter((r) => r.location === locationFilter);
    }
    return out;
  }, [rows, query, jobRoleFilter, locationFilter]);

  const filterActive = Boolean(
    query.trim() || jobRoleFilter || locationFilter
  );

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
          <div className="text-xs text-gray-600 mb-3">Admin - New Applicant Listings</div>

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

              <button
                type="button"
                onClick={() => void loadNewApplicants()}
                className="flex items-center gap-2 border border-zinc-200 hover:bg-zinc-50 px-6 py-3 rounded-2xl transition"
              >
                <RefreshCw className="w-5 h-5" /> Refresh
              </button>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-600">
                    {loading ? "—" : totalFromApi ?? rows.length}
                  </span>{" "}
                  in pipeline
                  {filterActive ? (
                    <>
                      {" "}
                      · Showing{" "}
                      <span className="font-medium text-gray-600">{filtered.length}</span> match
                      {filtered.length === 1 ? "" : "es"}
                    </>
                  ) : null}
                </div>
                <div className="h-5 w-px bg-zinc-200 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Type</span>
                  <span className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-gray-600">
                    Candidates
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Status</span>
                  <span className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-gray-600">
                    New
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="filter-job-role" className="text-xs text-gray-600">
                    Job Role
                  </label>
                  <select
                    id="filter-job-role"
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
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="filter-location" className="text-xs text-gray-600">
                    Location
                  </label>
                  <select
                    id="filter-location"
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
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftSearch("");
                    setDraftOrder(columnsOrder);
                    setDraftVisible(columnsVisible);
                    setEditColumnsOpen(true);
                  }}
                  className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 inline-flex items-center gap-2"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Edit columns
                </button>
                <button className="text-sm px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                  List View
                </button>
              </div>
            </div>

            {fetchError ? (
              <div className="px-6 py-10">
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
                  {fetchError}
                </div>
                <p className="text-center text-sm text-gray-600">
                  Check <code className="text-xs bg-zinc-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> and that
                  the <code className="text-xs bg-zinc-100 px-1 rounded">worker</code> table exists.
                </p>
              </div>
            ) : loading ? (
              <div className="text-center py-20 text-gray-600">Loading new applicants...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-600 space-y-2">
                <div>No new applicants found.</div>
                <div className="text-xs text-gray-600 max-w-md mx-auto">
                  Rows need <code className="bg-zinc-100 px-1 rounded">worker_status</code> of{" "}
                  <code className="bg-zinc-100 px-1 rounded">new</code> (enums use lowercase) or NULL. Legacy{" "}
                  <code className="bg-zinc-100 px-1 rounded">status</code> text is also supported.
                </div>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[980px] w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-widest text-gray-600 border-b border-zinc-100">
                      {columnsOrder
                        .filter((k) => columnsVisible[k])
                        .map((k) => {
                          const label = allColumns.find((c) => c.key === k)?.label ?? k;
                          const wide = k === "name" || k === "location" || k === "checklist";
                          return (
                            <th
                              key={k}
                              className={`${wide ? "px-6" : "px-4"} py-4 font-medium`}
                            >
                              {label}
                            </th>
                          );
                        })}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                        {columnsOrder
                          .filter((k) => columnsVisible[k])
                          .map((k) => {
                            if (k === "name") {
                              return (
                                <td key={k} className="px-6 py-4">
                                  <Link
                                    href={`/admin_recruiter/new/profile/${r.id}`}
                                    className="flex items-center gap-3 group"
                                  >
                                    <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                                      {initials(r.name)}
                                    </div>
                                    <div className="min-w-0 text-left">
                                      <div className="font-medium text-gray-600 truncate group-hover:text-teal-800 group-hover:underline">
                                        {r.name}
                                      </div>
                                      <div className="text-xs text-gray-600">Candidates</div>
                                    </div>
                                  </Link>
                                </td>
                              );
                            }
                            if (k === "status") {
                              return (
                                <td key={k} className="px-4 py-4">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                    {r.status}
                                  </span>
                                </td>
                              );
                            }
                            if (k === "reference") {
                              return (
                                <td key={k} className="px-4 py-4 text-sm text-gray-600">
                                  {r.reference}
                                </td>
                              );
                            }
                            if (k === "role") {
                              return (
                                <td key={k} className="px-4 py-4 text-sm text-gray-600">
                                  {r.role}
                                </td>
                              );
                            }
                            if (k === "createdAt") {
                              return (
                                <td key={k} className="px-4 py-4 text-sm text-gray-600">
                                  {formatDate(r.createdAt)}
                                </td>
                              );
                            }
                            if (k === "location") {
                              return (
                                <td key={k} className="px-6 py-4 text-sm text-gray-600">
                                  {r.location}
                                </td>
                              );
                            }
                            if (k === "checklist") {
                              return (
                                <td key={k} className="px-6 py-4 text-sm">
                                  <Link
                                    href={`/admin_recruiter/new/checklist/${r.id}`}
                                    className="inline-flex items-center justify-center px-4 py-2 rounded-2xl border border-zinc-200 hover:bg-zinc-50 transition"
                                  >
                                    Checklist
                                  </Link>
                                </td>
                              );
                            }
                            return null;
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Columns Modal (list view only) */}
      {editColumnsOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden">
            <div className="p-6 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-600">Edit Columns</div>
              <button
                type="button"
                onClick={() => setEditColumnsOpen(false)}
                className="w-10 h-10 rounded-2xl bg-zinc-900 text-white grid place-items-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pb-6 grid grid-cols-12 gap-6">
              {/* Left: choose display columns */}
              <div className="col-span-12 lg:col-span-6">
                <div className="text-sm font-semibold text-gray-600">Choose display columns</div>
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<ColumnKey, boolean> = { ...draftVisible };
                    (Object.keys(next) as ColumnKey[]).forEach((k) => {
                      next[k] = false;
                    });
                    setDraftVisible(next);
                  }}
                  className="mt-2 text-xs text-teal-700 hover:underline"
                >
                  Unselect All
                </button>

                <div className="mt-3 flex items-center gap-3 bg-white border border-zinc-200 rounded-2xl px-4 py-3">
                  <Search className="w-4 h-4 text-gray-600" />
                  <input
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    placeholder="Search fields"
                    className="outline-none bg-transparent text-sm flex-1"
                  />
                </div>

                <div className="mt-4 bg-white border border-zinc-200 rounded-2xl p-4 max-h-[380px] overflow-auto">
                  <div className="space-y-3">
                    {allColumns
                      .filter((c) => c.label.toLowerCase().includes(draftSearch.trim().toLowerCase()))
                      .map((c) => (
                        <label key={c.key} className="flex items-center gap-3 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={!!draftVisible[c.key]}
                            onChange={(e) => {
                              setDraftVisible((v) => ({ ...v, [c.key]: e.target.checked }));
                              if (e.target.checked && !draftOrder.includes(c.key)) {
                                setDraftOrder((o) => [...o, c.key]);
                              }
                            }}
                            className="accent-teal-700"
                          />
                          {c.label}
                        </label>
                      ))}
                  </div>
                </div>
              </div>

              {/* Right: reorder columns */}
              <div className="col-span-12 lg:col-span-6">
                <div className="text-sm font-semibold text-gray-600">Reorder the columns</div>

                <div className="mt-4 bg-white border border-zinc-200 rounded-2xl p-4 max-h-[420px] overflow-auto">
                  <div className="space-y-3">
                    {draftOrder
                      .filter((k) => draftVisible[k])
                      .map((k, idx, arr) => {
                        const label = allColumns.find((c) => c.key === k)?.label ?? k;
                        return (
                          <div
                            key={k}
                            className="flex items-center gap-3 border border-zinc-200 rounded-2xl px-4 py-3"
                          >
                            <GripVertical className="w-4 h-4 text-gray-600" />
                            <div className="text-sm text-gray-600 flex-1">{label}</div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="Move up"
                                disabled={idx === 0}
                                onClick={() => {
                                  if (idx === 0) return;
                                  const next = [...arr];
                                  const tmp = next[idx - 1]!;
                                  next[idx - 1] = next[idx]!;
                                  next[idx] = tmp;
                                  setDraftOrder(next);
                                }}
                                className="w-8 h-8 rounded-xl border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white grid place-items-center"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                disabled={idx === arr.length - 1}
                                onClick={() => {
                                  if (idx === arr.length - 1) return;
                                  const next = [...arr];
                                  const tmp = next[idx + 1]!;
                                  next[idx + 1] = next[idx]!;
                                  next[idx] = tmp;
                                  setDraftOrder(next);
                                }}
                                className="w-8 h-8 rounded-xl border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white grid place-items-center"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Remove"
                                onClick={() => {
                                  setDraftVisible((v) => ({ ...v, [k]: false }));
                                }}
                                className="w-8 h-8 rounded-xl border border-zinc-200 hover:bg-zinc-50 grid place-items-center"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-zinc-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditColumnsOpen(false)}
                className="px-6 py-3 rounded-2xl border border-zinc-200 hover:bg-zinc-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setColumnsOrder(draftOrder);
                  setColumnsVisible(draftVisible);
                  setEditColumnsOpen(false);
                }}
                className="px-6 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


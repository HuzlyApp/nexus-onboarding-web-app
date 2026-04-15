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
  RefreshCw,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Loader2,
  Bell,
  MessageCircle,
} from "lucide-react";

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

function titleCaseStatus(s: string | null | undefined) {
  const v = (s || "").trim();
  if (!v) return "—";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
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

export default function WorkersPage() {
  const pathname = usePathname() ?? "";
  const [workers, setWorkers] = useState<
    Array<{
      id: string;
      name: string;
      role: string;
      location: string;
      status: string;
    }>
  >([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [candidatesGroupOpen, setCandidatesGroupOpen] = useState(true);
  const [workersGroupOpen, setWorkersGroupOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [newOnly, setNewOnly] = useState(true);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(newOnly ? "/api/workers?worker_status=new" : "/api/workers", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch workers");

      const list: WorkerProfile[] = Array.isArray(data?.workers)
        ? data.workers
        : Array.isArray(data)
          ? data
          : [];
      setTotalFromApi(typeof data?.total === "number" ? data.total : list.length);

      const mapped = list.map((w) => {
        const name = `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim() || "Unnamed";
        const location = [w.city, w.state].filter(Boolean).join(", ") || "—";
        return {
          id: w.id,
          name,
          role: w.job_role || "—",
          location,
          status: titleCaseStatus(w.status ?? (newOnly ? "new" : "—")),
        };
      });
      setWorkers(mapped);
    } catch (err) {
      console.error("Failed to fetch workers:", err);
      setWorkers([]);
      setTotalFromApi(null);
    } finally {
      setLoading(false);
    }
  }, [newOnly]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  const filtered = useMemo(() => {
    let out = workers;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        );
      });
    }
    return out;
  }, [workers, query]);

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
            <div className="font-semibold text-2xl">Workers</div>
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
          <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-600">Worker table</h1>
              <div className="text-sm text-gray-600 mt-1">
                Data from <code className="bg-zinc-100 px-1 rounded">/api/workers</code> · Profile route{" "}
                <code className="bg-zinc-100 px-1 rounded">/admin_recruiter/workers/[id]/profile</code>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void loadWorkers()}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-gray-600 hover:bg-zinc-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen((v) => !v)}
                  className="flex items-center justify-center w-11 h-11 border border-zinc-200 bg-white hover:bg-zinc-50 rounded-2xl transition"
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
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-zinc-50"
                        onClick={() => {
                          setMoreMenuOpen(false);
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Plus className="w-4 h-4" /> Create worker
                        </span>
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewOnly(true)}
                className={`px-4 py-2 rounded-full text-sm border ${
                  newOnly ? "bg-white shadow border-zinc-200 text-gray-600" : "bg-zinc-50 border-zinc-200 text-gray-600"
                }`}
              >
                New only
              </button>
              <button
                type="button"
                onClick={() => setNewOnly(false)}
                className={`px-4 py-2 rounded-full text-sm border ${
                  !newOnly ? "bg-white shadow border-zinc-200 text-gray-600" : "bg-zinc-50 border-zinc-200 text-gray-600"
                }`}
              >
                All workers
              </button>
            </div>

            <div className="flex items-center bg-white border border-zinc-200 rounded-2xl px-4 py-3 w-full lg:max-w-xl">
              <Search className="w-5 h-5 text-gray-600 mr-3 shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, role, location, or id"
                className="bg-transparent outline-none flex-1 min-w-0 text-sm placeholder:text-gray-600"
              />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-gray-600">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                Loading workers…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-600">No workers found.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[860px] w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-600 border-b border-zinc-100 bg-zinc-50/80">
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-4 py-4 font-medium">Job role</th>
                      <th className="px-4 py-4 font-medium">Location</th>
                      <th className="px-4 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w) => (
                      <tr key={w.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                        <td className="px-6 py-4 font-medium text-gray-600">{w.name}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{w.role}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{w.location}</td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {w.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/admin_recruiter/workers/${w.id}/profile`}
                            className="inline-flex items-center gap-2 rounded-full bg-teal-600 text-white px-4 py-2 text-xs font-semibold hover:bg-teal-700"
                          >
                            Open <span aria-hidden>→</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Total: {loading ? "—" : totalFromApi ?? workers.length} workers
          </div>
        </div>
      </div>
    </div>
  );
}

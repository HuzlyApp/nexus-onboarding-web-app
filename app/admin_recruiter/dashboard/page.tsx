"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Calendar,
  LogOut,
  Menu,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
  Search,
  ArrowRight,
  MapPin,
  Sparkles,
} from "lucide-react";

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  city: string | null;
  state: string | null;
  created_at: string | null;
};

const sidebarItems = [
  { label: "Dashboard", href: "/admin_recruiter/dashboard", icon: Users },
  { label: "Candidates", href: "/admin_recruiter/candidates", icon: Users },
  { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
  { label: "Pending", href: "/admin_recruiter/pending", icon: UserCheck },
  { label: "Approved", href: "/admin_recruiter/approved", icon: UserCheck },
  { label: "Disapproved", href: "/admin_recruiter/disapproved", icon: UserX },
  { label: "Workers", href: "/admin_recruiter/workers", icon: Briefcase },
  { label: "Schedule", href: "/admin_recruiter/schedule", icon: Calendar },
] as const;

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function RecruiterDashboard() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState({
    new: 0,
    pending: 0,
    approved: 0,
    disapproved: 0,
  });

  useEffect(() => {
    async function run() {
      setLoading(true);
      try {
        const [allRes, cNew, cPending, cApproved, cDisapproved] = await Promise.all([
          fetch("/api/workers"),
          fetch("/api/workers?status=new&head=1"),
          fetch("/api/workers?status=pending&head=1"),
          fetch("/api/workers?status=approved&head=1"),
          fetch("/api/workers?status=disapproved&head=1"),
        ]);

        const allJson = await allRes.json();
        if (!allRes.ok) throw new Error(allJson?.error || "Failed to load workers");
        const list = Array.isArray(allJson)
          ? (allJson as WorkerRow[])
          : Array.isArray(allJson?.workers)
            ? (allJson.workers as WorkerRow[])
            : [];
        setWorkers(list);

        const parseTotal = async (r: Response) => {
          const j = await r.json().catch(() => ({}));
          return typeof j?.total === "number" ? j.total : 0;
        };
        const [n, p, a, d] = await Promise.all([
          parseTotal(cNew),
          parseTotal(cPending),
          parseTotal(cApproved),
          parseTotal(cDisapproved),
        ]);
        setCounts({ new: n, pending: p, approved: a, disapproved: d });
      } catch (e) {
        console.error("Failed to load dashboard workers:", e);
        setWorkers([]);
        setCounts({ new: 0, pending: 0, approved: 0, disapproved: 0 });
      } finally {
        setLoading(false);
      }
    }
    run();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) => {
      const name = `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim().toLowerCase();
      const role = (w.job_role ?? "").toLowerCase();
      const loc = `${w.city ?? ""} ${w.state ?? ""}`.trim().toLowerCase();
      return name.includes(q) || role.includes(q) || loc.includes(q);
    });
  }, [workers, query]);

  const recent = useMemo(() => filtered.slice(0, 6), [filtered]);

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
            <div>
              <div className="text-xs text-gray-600">Admin - Dashboard</div>
              <div className="font-semibold text-2xl">Dashboard</div>
            </div>
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
          <div className="max-w-[1320px] mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <div className="text-3xl font-semibold text-gray-600">Overview</div>
                <div className="text-sm text-gray-600 mt-1">Quick access to applicant pipelines and workers.</div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center bg-white border border-zinc-200 rounded-2xl px-5 py-3">
                  <Search className="w-5 h-5 text-gray-600 mr-3" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search workers by name, role, location"
                    className="bg-transparent outline-none flex-1 min-w-[260px]"
                  />
                </div>

                <Link
                  href="/admin_recruiter/advanced-search"
                  className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-6 py-3 rounded-2xl transition"
                >
                  <MapPin className="w-5 h-5" /> Advanced search
                </Link>
              </div>
            </div>

            {/* KPI cards */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <Link
                href="/admin_recruiter/workers"
                className="bg-white border border-zinc-200 rounded-3xl p-6 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Total workers</div>
                  <Sparkles className="w-5 h-5 text-teal-700" />
                </div>
                <div className="mt-3 text-3xl font-semibold text-gray-600">
                  {loading ? "—" : String(workers.length)}
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-teal-700">
                  View workers <ArrowRight className="w-4 h-4" />
                </div>
              </Link>

              {[
                { key: "new" as const, label: "New applicants", href: "/admin_recruiter/new", chip: "New", chipClass: "bg-slate-100 text-gray-600" },
                { key: "pending" as const, label: "Pending applicants", href: "/admin_recruiter/pending", chip: "Pending", chipClass: "bg-amber-100 text-amber-800" },
                { key: "approved" as const, label: "Approved applicants", href: "/admin_recruiter/approved", chip: "Approved", chipClass: "bg-emerald-100 text-emerald-800" },
                { key: "disapproved" as const, label: "Disapproved applicants", href: "/admin_recruiter/disapproved", chip: "Disapproved", chipClass: "bg-rose-100 text-rose-800" },
              ].map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="bg-white border border-zinc-200 rounded-3xl p-6 hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">{c.label}</div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${c.chipClass}`}>{c.chip}</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-gray-600">
                    {loading ? "—" : String(counts[c.key])}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-teal-700">
                    Open list <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Recent workers */}
            <div className="mt-8 bg-white border border-zinc-200 rounded-3xl overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-600">Recent workers</div>
                  <div className="text-xs text-gray-600">
                    Showing {recent.length} of {filtered.length}
                  </div>
                </div>
                <Link
                  href="/admin_recruiter/workers"
                  className="text-sm text-teal-700 hover:underline inline-flex items-center gap-2"
                >
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-gray-600">Loading…</div>
              ) : recent.length === 0 ? (
                <div className="p-6 text-gray-600">No workers found.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-[980px] w-full">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-widest text-gray-600 border-b border-zinc-100">
                        <th className="px-6 py-4 font-medium">Name</th>
                        <th className="px-4 py-4 font-medium">Job Role</th>
                        <th className="px-4 py-4 font-medium">Created</th>
                        <th className="px-6 py-4 font-medium">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((w) => {
                        const name =
                          `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim() || "Unnamed";
                        const location = [w.city, w.state].filter(Boolean).join(", ") || "—";
                        return (
                          <tr key={w.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{name}</td>
                            <td className="px-4 py-4 text-sm text-gray-600">{w.job_role || "—"}</td>
                            <td className="px-4 py-4 text-sm text-gray-600">{formatDate(w.created_at)}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{location}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
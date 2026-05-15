"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import DetailedCandidateHeader from "../../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../../components/DetailedTabs";

type WorkerProfilePayload = {
  worker: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    job_role: string | null;
  };
  notes?: NoteRow[];
};

type NoteRow = {
  id: string | null;
  body: string;
  created_at: string | null;
  actor_user_id: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "NA";
}

function formatDateTime(iso: string | null) {
  if (!iso) return "Just now";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Just now";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NewApplicantProfileNotesPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WorkerProfilePayload | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [profileRes, notesRes] = await Promise.all([
          fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(id)}`),
          fetch(`/api/admin/worker-notes?workerId=${encodeURIComponent(id)}`),
        ]);
        const profileJson = (await profileRes.json().catch(() => ({}))) as WorkerProfilePayload & {
          error?: string;
        };
        if (!profileRes.ok) throw new Error(profileJson.error || "Failed to load candidate");
        setProfile(profileJson);

        const notesJson = (await notesRes.json().catch(() => ({}))) as {
          notes?: NoteRow[];
          error?: string;
        };
        if (!notesRes.ok) throw new Error(notesJson.error || "Failed to load notes");
        setNotes(Array.isArray(notesJson.notes) ? notesJson.notes : profileJson.notes ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load notes");
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [id]);

  const candidateName = useMemo(() => {
    const n = `${profile?.worker?.first_name ?? ""} ${profile?.worker?.last_name ?? ""}`.trim();
    return n || "John Doe";
  }, [profile?.worker?.first_name, profile?.worker?.last_name]);
  const candidateRole = profile?.worker?.job_role || "Licensed Practical Nurse , LPN";
  const candidateInitials = initials(candidateName);
  const detailsHref = id ? `/admin_recruiter/new/profile/${id}` : "/admin_recruiter/new/profile";
  const resumeHref = id ? `/admin_recruiter/new/profile/resume/${id}` : "/admin_recruiter/new/profile/resume";
  const notesHref = id ? `/admin_recruiter/new/profile/notes/${id}` : "/admin_recruiter/new/profile/notes";

  async function handleSaveNote() {
    if (!id || saving) return;
    const body = noteBody.trim();
    if (!body) {
      setError("Enter a note before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/worker-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: id, body }),
      });
      const json = (await res.json().catch(() => ({}))) as { notes?: NoteRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save note");
      setNotes(Array.isArray(json.notes) ? json.notes : []);
      setNoteBody("");
      setShowNotePopup(false);
      setMessage("Note saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-[1300px] mx-auto">
        <DetailedCandidateHeader
          name={candidateName}
          role={candidateRole}
          loading={loading}
        />
        <DetailedTabs applicantId={id} activeTab="Profile" />

        <div className="mb-4 flex justify-center">
          <div className="h-9 w-[327px] rounded-xl bg-[#F8FAFC] p-1">
            <div className="grid h-full grid-cols-3 gap-1">
              <Link
                href={detailsHref}
                className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
              >
                Details
              </Link>
              <Link
                href={resumeHref}
                className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
              >
                Resume
              </Link>
              <Link
                href={notesHref}
                className="inline-flex items-center justify-center rounded-lg bg-[#0D9488] text-sm font-medium leading-5 text-white"
              >
                Notes
              </Link>
            </div>
          </div>
        </div>

        <div className="relative mx-auto h-[852px] w-full max-w-[1300px] rounded-md border border-zinc-200 bg-white p-5">
          {message ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div
            className={
              notes.length === 0
                ? "flex h-full flex-col items-center justify-center gap-[30px] text-center"
                : "flex h-full flex-col"
            }
          >
            {notes.length === 0 ? (
              <>
                <div className="flex flex-col items-center gap-3">
                  <h2 className="text-[18px] font-semibold leading-7 text-[#111827]">
                    You have not created any notes yet
                  </h2>
                  <p className="max-w-[560px] text-center text-[14px] font-normal leading-5 text-[#6B7280]">
                    All notes will be displayed on this page once the first note has been noted.
                  </p>
                  <Link
                    href="#"
                    className="text-center text-[14px] font-normal leading-5 text-[#0D9488] hover:underline"
                  >
                    Learn more about notes
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNotePopup(true)}
                  className="inline-flex h-10 w-[124px] items-center justify-center gap-2 rounded-[8px] bg-[#0D9488] px-4 py-[10px] text-sm font-semibold text-white hover:bg-[#0b7f75]"
                >
                  <span className="text-[20px] leading-none" aria-hidden="true">
                    +
                  </span>
                  <span>Add Note</span>
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-semibold leading-7 text-[#111827]">Notes</h2>
                    <p className="text-sm text-[#6B7280]">{notes.length} note{notes.length === 1 ? "" : "s"} for {candidateName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNotePopup(true)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0D9488] px-4 py-[10px] text-sm font-semibold text-white hover:bg-[#0b7f75]"
                  >
                    <span className="text-[20px] leading-none" aria-hidden="true">+</span>
                    <span>Add Note</span>
                  </button>
                </div>

                <div className="space-y-3 overflow-auto pr-1">
                  {notes.map((note, idx) => (
                    <article
                      key={note.id ?? `note-${idx}`}
                      className="rounded-lg border border-zinc-200 bg-[#F8FAFC] p-4 text-left"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(135deg,#27c8c0_0%,#16877f_100%)] text-[12px] font-semibold text-white">
                          {candidateInitials}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-[#111827]">{candidateName}</div>
                          <div className="text-xs text-[#6B7280]">{formatDateTime(note.created_at)}</div>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[#111827]">{note.body}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>

          {showNotePopup ? (
            <div className="absolute bottom-0 right-0 z-20 w-full max-w-[560px] rounded-t-lg border border-zinc-200 bg-white shadow-xl">
              <div className="flex h-10 items-center justify-between rounded-t-lg bg-[#0D9488] px-3">
                <div className="text-sm font-medium text-white">New Note</div>
                <div className="flex items-center gap-2 text-white">
                  <button
                    type="button"
                    onClick={() => setShowNotePopup(false)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15"
                    aria-label="Close note"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotePopup(false)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15"
                    aria-label="Minimize note"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 p-3">
                <div>
                  <div className="mb-1 text-xs text-[#6B7280]">Relate to</div>
                  <div className="flex h-10 items-center gap-3 rounded border border-[#94A3B8] bg-[#F8FAFC] px-3 text-sm text-[#111827]">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(135deg,#27c8c0_0%,#16877f_100%)] text-[12px] font-semibold text-white">
                      {candidateInitials}
                    </span>
                    <span>{candidateName}</span>
                  </div>
                </div>

                <div className="rounded border border-zinc-200">
                  <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-1 text-[#374151]">
                    {[
                      { icon: Bold, label: "Bold" },
                      { icon: Underline, label: "Underline" },
                      { icon: Italic, label: "Italic" },
                      { icon: Strikethrough, label: "Strike" },
                      { icon: List, label: "List" },
                      { icon: ListOrdered, label: "Numbered list" },
                      { icon: AlignLeft, label: "Align left" },
                      { icon: AlignCenter, label: "Align center" },
                      { icon: AlignRight, label: "Align right" },
                      { icon: AlignJustify, label: "Justify" },
                      { icon: Undo2, label: "Undo" },
                      { icon: Redo2, label: "Redo" },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-[#111827] hover:bg-zinc-100"
                        aria-label={item.label}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="Add your notes here"
                    className="h-[200px] w-full resize-none p-3 text-sm text-[#111827] placeholder:text-[#94A3B8] outline-none"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => void handleSaveNote()}
                    disabled={saving || !noteBody.trim()}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-[#0D9488] px-4 text-sm font-semibold text-white hover:bg-[#0b7f75] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


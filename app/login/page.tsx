// app/login/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import { supabase } from "@/lib/supabase/client";

function AdminRecruiterLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    agree: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.agree) return;
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.username.trim(),
      password: form.password,
    });

    if (signInError) {
      setError(signInError.message || "Login failed");
      setSubmitting(false);
      return;
    }

    const nextPath = searchParams.get("next");
    if (nextPath && nextPath.startsWith("/")) {
      router.push(nextPath);
    } else {
      router.push("/admin_recruiter/dashboard");
    }
    router.refresh();
    setSubmitting(false);
  };

  return (
    <OnboardingLayout
      cardClassName="md:w-[950px] md:min-w-[950px] md:max-w-[950px] md:h-[622px] md:min-h-[550px] md:grid-cols-[560px_390px]"
      rightPanelImageSrc="/images/handshake.jpg"
      rightPanelImageAlt="Handshake"
      rightPanelImageClassName="object-cover opacity-60 grayscale"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-6"
      taglineClassName="text-[15px] leading-6 text-slate-700"
    >
      {/* Left side - Login Form */}
      <div className="p-6 md:p-10 lg:p-12 flex flex-col justify-center">
          <div className="mb-10">
            <div className="w-12 h-1 bg-teal-500 rounded-full mb-4" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Admin Recruiter Login
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email
              </label>
              <input
                id="username"
                name="username"
                type="email"
                value={form.username}
                onChange={handleChange}
                placeholder="Email"
                autoComplete="email"
                className={cn(
                  "w-full px-4 py-3.5 border border-gray-300 rounded-lg",
                  "focus:ring-2 focus:ring-teal-500 focus:border-teal-500",
                  "placeholder-gray-400 transition-all outline-none"
                )}
                required
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Password"
                  autoComplete="current-password"
                  className={cn(
                    "w-full px-4 py-3.5 border border-gray-300 rounded-lg",
                    "focus:ring-2 focus:ring-teal-500 focus:border-teal-500",
                    "placeholder-gray-400 transition-all outline-none pr-11"
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3 pt-2">
              <input
                id="agree"
                name="agree"
                type="checkbox"
                checked={form.agree}
                onChange={handleChange}
                className="cursor-pointer h-5 w-5 accent-teal-600"
              />
              <label htmlFor="agree" className="text-sm text-gray-600 leading-6">
                By checking this box you agree to our{" "}
                <a
                  href="#"
                  className="text-teal-600 hover:underline font-medium"
                >
                  Terms & Conditions
                </a>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-3.5 px-6 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!form.username || !form.password || !form.agree || submitting}
                className={cn(
                  "flex-1 py-3.5 px-6 bg-teal-600 text-white rounded-lg",
                  "font-medium hover:bg-teal-700 transition-colors",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {submitting ? "Logging in..." : "Log in"}
              </button>
            </div>
          </form>
      </div>
    </OnboardingLayout>
  );
}

export default function AdminRecruiterLogin() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[linear-gradient(135deg,#27c8c0_0%,#16a79a_100%)]" />}>
      <AdminRecruiterLoginContent />
    </Suspense>
  );
}
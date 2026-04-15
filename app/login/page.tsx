// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Stethoscope } from "lucide-react";
import { cn } from "@/lib/cn";

export default function AdminRecruiterLogin() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.agree) return;

    // TODO: real auth logic (e.g. signIn from next-auth, or your API)
    console.log("Login attempt:", form);

    // Example redirect after success
    // router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-teal-600 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        className={cn(
          "w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden",
          "grid md:grid-cols-2 gap-0"
        )}
      >
        {/* Left side - Login Form */}
        <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
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
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
                placeholder="Username"
                autoComplete="username"
                className={cn(
                  "w-full px-4 py-3.5 border border-gray-300 rounded-lg",
                  "focus:ring-2 focus:ring-teal-500 focus:border-teal-500",
                  "placeholder-gray-400 transition-all outline-none"
                )}
                required
              />
            </div>

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
                className="mt-1 h-5 w-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
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
                disabled={!form.username || !form.password || !form.agree}
                className={cn(
                  "flex-1 py-3.5 px-6 bg-teal-600 text-white rounded-lg",
                  "font-medium hover:bg-teal-700 transition-colors",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                Log in
              </button>
            </div>
          </form>
        </div>

        {/* Right side - Branding (hidden on mobile) */}
        <div className="hidden md:flex flex-col items-center justify-center bg-teal-50/80 p-12 lg:p-16 relative">
          <div className="text-center space-y-8 max-w-md">
            {/* Logo / Icon */}
            <div className="flex justify-center">
              <div className="w-28 h-28 md:w-32 md:h-32 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                <Stethoscope size={64} strokeWidth={1.5} />
              </div>
            </div>

            <div>
              <h2 className="text-5xl md:text-6xl font-bold text-teal-800 tracking-tight">
                NEXUS
              </h2>
              <p className="text-xl md:text-2xl font-medium text-teal-700 mt-2">
                MedPro Staffing
              </p>
            </div>

            <p className="text-lg text-teal-700 leading-relaxed">
              Connecting Healthcare professionals with service providers
            </p>

            {/* Decorative line */}
            <div className="flex items-center justify-center gap-6 pt-6">
              <div className="h-0.5 w-20 bg-teal-400/60" />
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                <Stethoscope size={24} className="text-teal-600" />
              </div>
              <div className="h-0.5 w-20 bg-teal-400/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
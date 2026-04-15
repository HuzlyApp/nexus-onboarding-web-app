// components/onboarding/ResumeReviewForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumeData as ParsedResumeData } from "@/lib/resumeSchema";

export interface FormResumeData {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  job_role?: string;
}

function isParsedResume(
  data: ParsedResumeData | FormResumeData
): data is ParsedResumeData {
  return (
    "firstName" in data ||
    "fullName" in data ||
    "zipCode" in data ||
    "jobRole" in data
  );
}

function toFormResumeData(
  raw: ParsedResumeData | FormResumeData | null | undefined
): FormResumeData {
  if (!raw) return {};

  if (isParsedResume(raw)) {
    let first_name = raw.firstName ?? "";
    let last_name = raw.lastName ?? "";
    const fullName = raw.fullName ?? undefined;
    if (fullName && !first_name.trim() && !last_name.trim()) {
      const parts = fullName.trim().split(/\s+/);
      first_name = parts[0] || "";
      last_name = parts.slice(1).join(" ") || "";
    }
    return {
      first_name,
      last_name,
      full_name: fullName,
      address1: raw.address ?? "",
      address2: raw.address2 ?? "",
      city: raw.city ?? "",
      state: raw.state ?? "",
      zip_code: raw.zipCode ?? "",
      phone: raw.phone ?? "",
      email: raw.email ?? "",
      job_role: raw.jobRole ?? "",
    };
  }

  const data = raw;
  let first_name = data.first_name || "";
  let last_name = data.last_name || "";

  if (data.full_name && !first_name.trim() && !last_name.trim()) {
    const parts = data.full_name.trim().split(/\s+/);
    first_name = parts[0] || "";
    last_name = parts.slice(1).join(" ") || "";
  }

  return {
    first_name,
    last_name,
    address1: data.address1 || "",
    address2: data.address2 || "",
    city: data.city || "",
    state: data.state || "",
    zip_code: data.zip_code || "",
    phone: data.phone || "",
    email: data.email || "",
    job_role: data.job_role || "",
    ...data,
  };
}

interface Props {
  initialData?: ParsedResumeData | FormResumeData | null;
  onSave?: (updatedData: FormResumeData) => void;
}

export default function ResumeReviewForm({ initialData = {}, onSave }: Props) {
  const router = useRouter();

  const [formData, setFormData] = useState<FormResumeData>(() =>
    toFormResumeData(initialData)
  );

  const [sameAddress, setSameAddress] = useState(true);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Optional: reconstruct full_name for backend
    const dataToSave = {
      ...formData,
      full_name:
        formData.full_name ||
        `${formData.first_name || ""} ${formData.last_name || ""}`.trim(),
    };

    onSave?.(dataToSave);

    router.push("/onboarding/skill-assessment");
  };

  // Optional: nice loading/fallback UI when no data
  if (!initialData) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Loading resume details...</h2>
        <p className="text-gray-600">Please wait while we prepare your information.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 text-center md:text-left">
        Review resume details
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              required
            />
          </div>
        </div>

        {/* Address 1 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address 1
          </label>
          <input
            type="text"
            name="address1"
            value={formData.address1 || ""}
            onChange={handleChange}
            placeholder="Street Address, P.O. Box"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        {/* Address 2 + Checkbox */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address 2 (Apt, Suite, etc.)
            </label>
            <input
              type="text"
              name="address2"
              value={formData.address2 || ""}
              onChange={handleChange}
              placeholder="Apt, Suite, Building, Floor, etc."
              disabled={sameAddress}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100"
            />
          </div>

          <div className="pt-8">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAddress}
                onChange={(e) => {
                  setSameAddress(e.target.checked);
                  if (e.target.checked) {
                    setFormData((prev) => ({ ...prev, address2: "" }));
                  }
                }}
                className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Same as address 1</span>
            </label>
          </div>
        </div>

        {/* City, State, Zip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              name="city"
              value={formData.city || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <select
              name="state"
              value={formData.state || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
            >
              <option value="">Select state</option>
              <option value="California">California</option>
              <option value="New York">New York</option>
              {/* Add more states */}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zip Code
            </label>
            <input
              type="text"
              name="zip_code"
              value={formData.zip_code || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>

        {/* Phone & Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email || ""}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>

        {/* Job Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Role
          </label>
          <select
            name="job_role"
            value={formData.job_role || ""}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
          >
            <option value="">Select role</option>
            <option value="CNA">CNA</option>
            <option value="RN">RN</option>
            <option value="LPN">LPN</option>
            {/* Add more healthcare roles */}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>

          <button
            type="submit"
            className="px-8 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            Save & continue
          </button>
        </div>
      </form>
    </div>
  );
}
"use client"

import { useState } from "react"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import RightPanel from "@/app/components/RightPanel"

export default function UploadPage() {
  const [fileName, setFileName] = useState("")
  const [isUploaded, setIsUploaded] = useState(false)

  const handleUpload = async (file: File) => {
    setFileName(file.name)

    const text = await file.text()

    const res = await fetch("/api/parse-resume", {
      method: "POST",
      body: JSON.stringify({ text }),
    })

    const data = await res.json()

    localStorage.setItem("parsedResume", JSON.stringify(data))

    setIsUploaded(true)
  }

  return (
    <OnboardingLayout>

      {/* LEFT */}
      <div className="w-2/3 flex flex-col items-center justify-center p-10">

        <h2 className="text-xl font-semibold mb-6">
          Upload your resume
        </h2>

        {/* DROP ZONE */}
        <label className={`w-full border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition
          ${isUploaded ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-teal-500"}
        `}>

          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
            }}
          />

          {!isUploaded ? (
            <>
              <p className="text-gray-600 font-medium">
                Drag and drop or upload file
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Choose File
              </p>
            </>
          ) : (
            <>
              <p className="text-green-600 font-semibold">
                ✅ File Uploaded
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {fileName}
              </p>
            </>
          )}

        </label>

        {/* BUTTON */}
        {isUploaded && (
          <button
            onClick={() => {
              window.location.href = "/application/step-1-review"
            }}
            className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-lg"
          >
            Continue
          </button>
        )}

        {/* CARD (LEFT IMAGE LIKE FIGMA) */}
        <div className="mt-10 bg-gray-100 p-4 rounded-xl w-[200px] text-center">
          <img
            src="/images/handshake.jpg"
            className="rounded-lg mb-3"
          />
          <h3 className="text-teal-700 font-bold">NEXUS</h3>
          <p className="text-xs text-gray-500">
            Connecting Healthcare professionals with service providers
          </p>
        </div>

      </div>

      <RightPanel />

    </OnboardingLayout>
  )
}
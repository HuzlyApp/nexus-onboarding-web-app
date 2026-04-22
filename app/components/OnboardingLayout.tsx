
"use client"

import Image from "next/image"
import { cn } from "@/lib/cn"

type Props = {
  children: React.ReactNode
  cardClassName?: string
  rightPanelClassName?: string
  rightPanelContentClassName?: string
  rightPanelInnerClassName?: string
  logoClassName?: string
  taglineClassName?: string
  rightPanelImageSrc?: string
  rightPanelImageAlt?: string
  rightPanelImageClassName?: string
  rightPanelOverlayClassName?: string
}

export default function OnboardingLayout({
  children,
  cardClassName,
  rightPanelClassName,
  rightPanelContentClassName,
  rightPanelInnerClassName,
  logoClassName,
  taglineClassName,
  rightPanelImageSrc,
  rightPanelImageAlt,
  rightPanelImageClassName,
  rightPanelOverlayClassName
}: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#27c8c0_0%,#16a79a_100%)] p-4 sm:p-6 lg:p-8">
      <div
        className={cn(
          "w-full overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] md:grid md:min-h-[650px] md:min-w-[1060px] md:max-w-[1060px] md:grid-cols-[730px_330px] h-full",
          cardClassName
        )}
      >
        <div className="min-w-0 border-b border-slate-200 md:border-b-0 md:border-r md:border-slate-200">
          {children}
        </div>

        <div className={cn("relative hidden md:block", rightPanelClassName)}>
          <Image
            src={rightPanelImageSrc ?? "/images/nurse.jpg"}
            alt={rightPanelImageAlt ?? "Nexus MedPro nurse"}
            fill
            sizes="(max-width: 767px) 0px, 330px"
            className={cn("object-cover grayscale", rightPanelImageClassName)}
            priority
          />
          <div
            className={cn(
              "absolute inset-0 bg-white/50",
              rightPanelOverlayClassName
            )}
          />

          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center p-8",
              rightPanelContentClassName
            )}
          >
            <div
              className={cn(
                "flex w-full max-w-[270px] flex-col items-center gap-6 text-center",
                rightPanelInnerClassName
              )}
            >
              <div
                className={cn(
                  "relative h-[60px] w-[204px] max-w-full ",
                  logoClassName
                )}
              >
                <Image
                  src="/images/new-logo-nexus.svg"
                  alt="Nexus MedPro Logo"
                  fill
                  sizes="204px"
                  className="object-contain "
                  priority
                />
              </div>

              <div className="flex w-full items-center justify-center gap-4">
                <div className="h-px flex-1 bg-slate-400/55" />
                <Image
                  src="/icons/circle-star-icon.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 flex-none"
                />
                <div className="h-px flex-1 bg-slate-400/55" />
              </div>

              <p
                className={cn(
                  "text-center text-[16px] font-normal leading-6 tracking-normal text-black",
                  taglineClassName
                )}
              >
                Nexus MedPro Staffing {"\u2013"} Connecting Healthcare
                professionals with service providers
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

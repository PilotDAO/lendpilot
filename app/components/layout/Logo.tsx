"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 40 }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="LandPilot Logo"
      width={size}
      height={size}
      className={className}
      priority
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: "contain",
      }}
    />
  );
}

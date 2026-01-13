"use client";

import Image from "next/image";

interface MarketNameProps {
  displayName: string;
  className?: string;
  logoSize?: number;
}

/**
 * Component that replaces "Aave" or "AAVE" in market display name with Aave logo
 */
export function MarketName({ displayName, className = "", logoSize = 20 }: MarketNameProps) {
  // Replace "Aave" or "AAVE" (case insensitive) with logo
  const parts = displayName.split(/(Aave|AAVE)/i);
  
  // Aave logo aspect ratio: 93:58 ≈ 1.603:1
  const logoHeight = Math.round(logoSize / 1.603);
  
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {parts.map((part, index) => {
        // Check if part matches "Aave" (case insensitive)
        if (/^Aave$/i.test(part.trim())) {
          return (
            <Image
              key={index}
              src="/aave-logo.svg"
              alt="Aave"
              width={logoSize}
              height={logoHeight}
              className="inline-block align-middle"
              style={{
                width: `${logoSize}px`,
                height: `${logoHeight}px`,
                display: "inline-block",
                verticalAlign: "middle",
              }}
            />
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

"use client";

import Image from "next/image";
import { getChainLogoUrl, getChainName } from "@/lib/utils/chain-logo";

interface MarketNameProps {
  displayName: string;
  marketKey?: string;
  className?: string;
  logoSize?: number;
}

/**
 * Component that displays market name with Aave logo, chain logo, and formatted name
 * Matches the format used in StablecoinsTable
 */
export function MarketName({ 
  displayName, 
  marketKey,
  className = "", 
  logoSize = 20 
}: MarketNameProps) {
  // Get chain logo and name if marketKey is provided
  const chainLogoUrl = marketKey ? getChainLogoUrl(marketKey) : null;
  const chainName = marketKey ? getChainName(marketKey) : null;

  // Format market name: remove "Aave", move "V3" to end with space
  // Example: "AaveV3Ethereum" -> "Ethereum V3"
  // Example: "AaveV3EthereumEtherFi" -> "Ethereum EtherFi V3"
  let formattedMarketName = displayName
    .replace(/^Aave\s*/i, "") // Remove Aave from start
    .replace(/\s*Aave\s*/i, " ") // Remove Aave from middle
    .trim();
  
  // Remove V3 from anywhere
  const hasV3 = /V3/i.test(formattedMarketName);
  formattedMarketName = formattedMarketName
    .replace(/\s*V3\s*/i, "") // Remove V3 from anywhere
    .trim();
  
  // Add spaces before capital letters (camelCase to Words)
  // Example: "EthereumEtherFi" -> "Ethereum EtherFi"
  formattedMarketName = formattedMarketName.replace(/([a-z])([A-Z])/g, "$1 $2");
  
  // Add V3 at the end if it was present or if marketKey suggests V3
  if (hasV3 || (marketKey && marketKey.includes("-v3"))) {
    formattedMarketName = formattedMarketName + " V3";
  }

  // Aave logo aspect ratio: 93:58 ≈ 1.603:1
  const logoHeight = Math.round(logoSize / 1.603);
  const chainLogoSize = logoSize;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Aave logo with tooltip */}
      <div className="relative group flex-shrink-0">
        <Image
          src="/aave-logo.svg"
          alt="Aave"
          width={logoSize}
          height={logoHeight}
          className="inline-block"
          style={{
            width: `${logoSize}px`,
            height: `${logoHeight}px`,
            display: "inline-block",
          }}
        />
        {/* Tooltip on hover */}
        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
          Aave
        </span>
      </div>
      {/* Chain logo */}
      {chainLogoUrl && (
        <Image
          src={chainLogoUrl}
          alt={chainName || ""}
          width={chainLogoSize}
          height={chainLogoSize}
          className="rounded-full flex-shrink-0"
          style={{
            width: `${chainLogoSize}px`,
            height: `${chainLogoSize}px`,
            display: "inline-block",
          }}
          unoptimized
          onError={(e) => {
            // Hide image if it fails to load
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {/* Market name text */}
      <span className="text-sm whitespace-nowrap">{formattedMarketName}</span>
    </span>
  );
}

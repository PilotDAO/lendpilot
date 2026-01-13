"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarketName } from "@/app/components/MarketName";

interface Market {
  marketKey: string;
  displayName: string;
}

export function MarketsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Fetch markets from API
    fetch("/api/v1/markets")
      .then((res) => res.json())
      .then((data) => {
        if (data.markets && Array.isArray(data.markets)) {
          setMarkets(
            data.markets.map((m: { marketKey: string; name?: string; displayName?: string }) => ({
              marketKey: m.marketKey,
              displayName: m.displayName || m.name || m.marketKey,
            }))
          );
        } else {
          // Fallback to default market if API structure is unexpected
          setMarkets([
            { marketKey: "ethereum-v3", displayName: "Ethereum V3" },
          ]);
        }
      })
      .catch(() => {
        // Fallback to default market if API fails
        setMarkets([
          { marketKey: "ethereum-v3", displayName: "Ethereum V3" },
        ]);
      });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Get current market from pathname
  const currentMarket = pathname?.split("/")[1] || null;
  const currentMarketName =
    markets.find((m) => m.marketKey === currentMarket)?.displayName || "Markets";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MarketName displayName={currentMarketName} logoSize={16} />
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
          {markets.map((market) => {
            const isActive = pathname?.startsWith(`/${market.marketKey}`);
            return (
              <Link
                key={market.marketKey}
                href={`/${market.marketKey}`}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <MarketName displayName={market.displayName} logoSize={16} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

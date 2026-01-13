"use client";

import { useState } from "react";
import Link from "next/link";
import { MarketName } from "@/app/components/MarketName";

interface AssetTopCardsProps {
  reserve: {
    symbol: string;
    name: string;
    imageUrl?: string;
    currentState: {
      supplyAPR: number;
      borrowAPR: number;
      totalSuppliedUSD: number;
      totalBorrowedUSD: number;
      oraclePrice: number;
      suppliedTokens: string;
      borrowedTokens: string;
      utilizationRate?: number;
    };
  };
  marketDisplayName?: string;
  marketKey?: string;
  contractAddress?: string;
}

function formatUSD(value: number): string {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function AssetTopCards({ reserve, marketDisplayName, marketKey, contractAddress }: AssetTopCardsProps) {
  const [copied, setCopied] = useState(false);
  
  const utilizationRate = reserve.currentState.utilizationRate 
    ? reserve.currentState.utilizationRate * 100 
    : reserve.currentState.totalSuppliedUSD > 0
    ? (reserve.currentState.totalBorrowedUSD / reserve.currentState.totalSuppliedUSD) * 100
    : 0;

  const handleCopyAddress = async () => {
    if (contractAddress) {
      try {
        await navigator.clipboard.writeText(contractAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy address:", err);
      }
    }
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Hero Card - Asset Info + Key Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            {reserve.imageUrl && (
              <img
                src={reserve.imageUrl}
                alt={reserve.symbol}
                width={40}
                height={40}
                className="rounded-full"
              />
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {reserve.symbol}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{reserve.name}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Oracle Price</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatUSD(reserve.currentState.oraclePrice)}
            </div>
          </div>
        </div>

        {/* Market Info */}
        {(marketDisplayName || contractAddress) && (
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Market
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {marketDisplayName && marketKey && (
                <Link 
                  href={`/${marketKey}`}
                  className="flex items-center hover:opacity-80 transition-opacity"
                >
                  <MarketName displayName={marketDisplayName} marketKey={marketKey} logoSize={16} />
                </Link>
              )}
              {marketDisplayName && !marketKey && (
                <div className="flex items-center">
                  <MarketName displayName={marketDisplayName} marketKey={marketKey} logoSize={16} />
                </div>
              )}
              {contractAddress && (
                <div className="flex items-center gap-1.5">
                  <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
                    {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                  </code>
                  <button
                    onClick={handleCopyAddress}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-0.5"
                    title={copied ? "Copied!" : "Copy full address"}
                  >
                    {copied ? (
                      <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Key Metrics Grid - Compact 2x2 */}
        <div className="grid grid-cols-2 gap-4">
          {/* APR Metrics */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              APR Rates
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Supply</span>
                </div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatPercent(reserve.currentState.supplyAPR)}
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Borrow</span>
                </div>
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {formatPercent(reserve.currentState.borrowAPR)}
                </div>
              </div>
            </div>
          </div>

          {/* Supply/Borrow Metrics */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Liquidity
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Supplied</span>
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatUSD(reserve.currentState.totalSuppliedUSD)}
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Borrowed</span>
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatUSD(reserve.currentState.totalBorrowedUSD)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Utilization Rate Bar */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Utilization Rate
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {utilizationRate.toFixed(2)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                utilizationRate > 80
                  ? 'bg-red-500'
                  : utilizationRate > 60
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(utilizationRate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

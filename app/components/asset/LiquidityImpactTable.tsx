"use client";

import { useState, useMemo } from "react";

interface LiquidityImpactTableProps {
  results: Array<{
    scenario: {
      action: "Deposit" | "Borrow" | "Repay" | "Withdraw";
      amountUSD: number;
    };
    impact: {
      newUtilization: number;
      newSupplyAPR: number;
      newBorrowAPR: number;
      deltaUtilization: number;
      deltaSupplyAPR: number;
      deltaBorrowAPR: number;
    };
  }>;
  currentState?: {
    supplyAPR: number;
    borrowAPR: number;
    utilizationRate: number;
  };
}

type ActionFilter = "Deposit" | "Borrow" | "Repay" | "Withdraw" | "All";

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

function formatDelta(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function getDeltaColor(delta: number): string {
  if (delta > 0) {
    return "text-red-600 dark:text-red-400";
  } else if (delta < 0) {
    return "text-green-600 dark:text-green-400";
  }
  return "text-gray-500 dark:text-gray-400";
}

export function LiquidityImpactTable({ results, currentState }: LiquidityImpactTableProps) {
  const [selectedAction, setSelectedAction] = useState<ActionFilter>("Deposit");

  // Get unique actions from results
  const availableActions = useMemo(() => {
    const actions = new Set<ActionFilter>();
    results.forEach((r) => {
      actions.add(r.scenario.action);
    });
    return Array.from(actions).sort();
  }, [results]);

  // Filter results by selected action
  const filteredResults = useMemo(() => {
    if (selectedAction === "All") {
      return results;
    }
    return results.filter((r) => r.scenario.action === selectedAction);
  }, [results, selectedAction]);

  // Get current state values (prefer prop, otherwise calculate from first result)
  const currentSupplyAPR = currentState?.supplyAPR ?? 
    (results.length > 0 
      ? results[0].impact.newSupplyAPR - results[0].impact.deltaSupplyAPR 
      : 0);
  const currentBorrowAPR = currentState?.borrowAPR ?? 
    (results.length > 0 
      ? results[0].impact.newBorrowAPR - results[0].impact.deltaBorrowAPR 
      : 0);
  const currentUtilization = currentState?.utilizationRate ?? 
    (results.length > 0 
      ? results[0].impact.newUtilization - results[0].impact.deltaUtilization 
      : 0);

  if (!results || results.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Liquidity Impact Scenarios
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Insufficient data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Liquidity Impact Scenarios
        </h3>
        
        {/* Action Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {availableActions.map((action) => (
            <button
              key={action}
              onClick={() => setSelectedAction(action)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedAction === action
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  Supply APR
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 text-gray-400 cursor-help"
                    title="Supply APR after the action (change from current)"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  Borrow APR
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 text-gray-400 cursor-help"
                    title="Borrow APR after the action (change from current)"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  Utilization
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 text-gray-400 cursor-help"
                    title="Utilization rate after the action"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {/* Current state row */}
            <tr className="bg-gray-50 dark:bg-gray-800 font-medium">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                current
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {formatPercent(currentSupplyAPR)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {formatPercent(currentBorrowAPR)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {formatPercent(currentUtilization)}
              </td>
            </tr>
            
            {/* Filtered results */}
            {filteredResults.map((result, index) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {formatUSD(result.scenario.amountUSD)} {result.scenario.action.toLowerCase()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <span>{formatPercent(result.impact.newSupplyAPR)}</span>
                  <span className={`ml-2 ${getDeltaColor(result.impact.deltaSupplyAPR)}`}>
                    ({formatDelta(result.impact.deltaSupplyAPR)})
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <span>{formatPercent(result.impact.newBorrowAPR)}</span>
                  <span className={`ml-2 ${getDeltaColor(result.impact.deltaBorrowAPR)}`}>
                    ({formatDelta(result.impact.deltaBorrowAPR)})
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <span>{formatPercent(result.impact.newUtilization)}</span>
                  <span className={`ml-2 ${getDeltaColor(result.impact.deltaUtilization)}`}>
                    ({formatDelta(result.impact.deltaUtilization)})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

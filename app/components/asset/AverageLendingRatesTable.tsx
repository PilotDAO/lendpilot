"use client";

interface AverageLendingRatesTableProps {
  rates: Record<
    string,
    {
      supplyAPR: number | null;
      borrowAPR: number | null;
    }
  >;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "N/A";
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function AverageLendingRatesTable({ rates }: AverageLendingRatesTableProps) {
  const periods = [
    { key: "1d", label: "1 Day" },
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "6m", label: "6 Months" },
    { key: "1y", label: "1 Year" },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Average Lending Rates
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Supply APR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Borrow APR
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {periods.map((period) => {
              const rate = rates[period.key];
              return (
                <tr key={period.key} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {period.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatPercent(rate?.supplyAPR ?? null)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatPercent(rate?.borrowAPR ?? null)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

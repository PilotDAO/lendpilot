import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        404
      </h1>
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Page Not Found
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4 text-center max-w-md">
        The market or asset you&apos;re looking for doesn&apos;t exist or the URL is invalid.
        Please check the URL and try again.
      </p>
      <div className="text-sm text-gray-500 dark:text-gray-500 mb-8 text-center max-w-md">
        <p>Common issues:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Invalid market key (e.g., use &quot;ethereum-v3&quot; not &quot;ethereum&quot;)</li>
          <li>Invalid asset address format (must be 0x + 40 hex characters)</li>
          <li>Asset not available in the specified market</li>
        </ul>
      </div>
      <Link
        href="/"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Home
      </Link>
    </div>
  );
}

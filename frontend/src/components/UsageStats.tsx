import { useEffect, useState } from "react";
import { authedFetch } from "../lib/api";
import { useAuth } from "./AuthProvider";

interface UsageData {
  count: number;
  total_size: number;
}

interface UsageStatsProps {
  refreshTrigger?: number;
}

export function UsageStats({ refreshTrigger = 0 }: UsageStatsProps) {
  const { token } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    if (!token) return;
    authedFetch("/user/usage")
      .then((res) => res.json())
      .then((data) => setUsage(data))
      .catch((err) => console.error("Failed to load usage", err));
  }, [token, refreshTrigger]);

  if (!usage) return null;

  const maxFiles = 50;
  const maxSize = 10 * 1024 * 1024; // 10MB

  const filePercent = Math.min(100, (usage.count / maxFiles) * 100);
  const sizePercent = Math.min(100, (usage.total_size / maxSize) * 100);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border border-zinc-800 rounded-lg p-3 space-y-2.5 bg-zinc-900/30">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Files</span>
          <span className="font-mono tabular-nums text-zinc-300">
            {usage.count} / {maxFiles}
          </span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              filePercent > 90 ? "bg-red-500" : "bg-blue-500"
            }`}
            style={{ width: `${filePercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Storage</span>
          <span className="font-mono tabular-nums text-zinc-300">
            {formatSize(usage.total_size)} / 10 MB
          </span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              sizePercent > 90 ? "bg-red-500" : "bg-blue-500"
            }`}
            style={{ width: `${sizePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

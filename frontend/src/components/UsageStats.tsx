import { useEffect, useState } from "react";
import { authedFetch } from "../lib/api";
import { useAuth } from "./AuthProvider";
import { Database, HardDrive, FileText } from "lucide-react";

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

  const maxFiles = 10;
  const maxSize = 10 * 1024 * 1024; // 10MB

  const filePercent = Math.min(100, (usage.count / maxFiles) * 100);
  const sizePercent = Math.min(100, (usage.total_size / maxSize) * 100);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
      <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
        <Database className="w-4 h-4" /> Storage Usage
      </h3>

      {/* File Count */}
      <div>
        <div className="flex justify-between text-xs text-slate-300 mb-1">
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" /> Files
          </span>
          <span>
            {usage.count} / {maxFiles}
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              filePercent > 90 ? "bg-red-500" : "bg-indigo-500"
            }`}
            style={{ width: `${filePercent}%` }}
          />
        </div>
      </div>

      {/* Total Size */}
      <div>
        <div className="flex justify-between text-xs text-slate-300 mb-1">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" /> Space
          </span>
          <span>{formatSize(usage.total_size)} / 10 MB</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              sizePercent > 90 ? "bg-red-500" : "bg-emerald-500"
            }`}
            style={{ width: `${sizePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

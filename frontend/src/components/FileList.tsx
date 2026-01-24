import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authedFetch } from "../lib/api";
import { useAuth } from "./AuthProvider";
import { CheckCircle2, Clock, AlertCircle, Trash2 } from "lucide-react";

interface Doc {
  id: string;
  filename: string;
  status: string;
  error_message?: string | null;
  created_at: string;
  file_size: number;
}

export function FileList({
  refreshTrigger,
  onDelete,
}: {
  refreshTrigger: number;
  onDelete?: () => void;
}) {
  const { token } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);

    const fetchDocs = () => {
      authedFetch("/documents")
        .then((res) => res.json())
        .then((data) => {
          if (active && Array.isArray(data)) setDocs(data);
        })
        .catch((err) => console.error("Failed to load docs", err))
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    fetchDocs();
    return () => {
      active = false;
    };
  }, [token, refreshTrigger]);

  // Poll while any document is still pending or processing
  useEffect(() => {
    if (!token) return;
    const hasActive = docs.some(
      (d) => d.status === "pending" || d.status === "processing"
    );
    if (!hasActive) return;

    const timer = setInterval(() => {
      authedFetch("/documents")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setDocs(data);
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(timer);
  }, [token, docs]);

  const handleDelete = async (docId: string) => {
    try {
      const res = await authedFetch(`/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (onDelete) onDelete();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete file");
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (doc: Doc) => {
    switch (doc.status) {
      case "completed":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "processing":
      case "pending":
        return <Clock className="w-3.5 h-3.5 text-amber-400" />;
      case "failed":
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  return (
    <div className="border border-zinc-800 rounded-lg flex flex-col h-full max-h-[500px] bg-zinc-900/20">
      <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Documents
        </h3>
        <span className="text-xs font-mono tabular-nums text-zinc-500">
          {docs.length}
        </span>
      </div>

      <div className="overflow-y-auto flex-1 divide-y divide-zinc-800/60">
        {loading && docs.length === 0 && (
          <div className="p-6 text-center text-xs text-zinc-500">
            Loading...
          </div>
        )}

        {!loading && docs.length === 0 && (
          <div className="p-6 text-center text-xs text-zinc-500">
            No documents uploaded.
          </div>
        )}

        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between px-3 py-2.5 hover:bg-zinc-900/60 transition-colors"
          >
            <div className="min-w-0 pr-2">
              <p className="text-xs font-medium text-zinc-200 truncate font-mono">
                {doc.filename}
              </p>
              <p className="text-[11px] text-zinc-500 tabular-nums mt-0.5">
                {formatSize(doc.file_size)} ·{" "}
                {new Date(doc.created_at).toLocaleDateString()}
              </p>
              {doc.status === "failed" && doc.error_message && (
                <p className="text-[11px] text-red-400 truncate mt-0.5">
                  {doc.error_message}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span title={doc.error_message || doc.status}>
                {getStatusIcon(doc)}
              </span>
              <button
                onClick={() => handleDelete(doc.id)}
                className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                title="Delete"
                aria-label={`Delete ${doc.filename}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

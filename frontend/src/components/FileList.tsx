import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authedFetch } from "../lib/api";
import { useAuth } from "./AuthProvider";
import { File, CheckCircle, Clock, AlertCircle, Trash } from "lucide-react";

interface Doc {
  id: string;
  filename: string;
  status: string;
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
    setLoading(true);
    const fetchDocs = () => {
      authedFetch("/documents")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setDocs(data);
        })
        .catch((err) => console.error("Failed to load docs", err))
        .finally(() => setLoading(false));
    };
    fetchDocs();
  }, [token, refreshTrigger]);

  const handleDelete = async (docId: string) => {
    try {
      const res = await authedFetch(`/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      // Refresh list
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (onDelete) onDelete();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete file");
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "processing":
        return <Clock className="w-4 h-4 text-amber-400 animate-pulse" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-full max-h-[500px]">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
          <File className="w-4 h-4 text-indigo-400" /> My Documents
        </h3>
      </div>

      <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
        {loading && docs.length === 0 && (
          <div className="text-center p-8 text-slate-500 animate-pulse">
            Loading...
          </div>
        )}

        {!loading && docs.length === 0 && (
          <div className="text-center p-8 text-slate-500">
            No files uploaded yet.
          </div>
        )}

        {docs.map((doc) => (
          <div
            key={doc.id}
            className="group flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-700/50"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors">
                <File className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {doc.filename}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  {formatSize(doc.file_size)} •{" "}
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="pl-2" title={doc.status}>
                {getStatusIcon(doc.status)}
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-red-500 hover:text-red-400"
                title="Delete"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

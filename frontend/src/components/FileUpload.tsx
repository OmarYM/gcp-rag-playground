import { useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { getApiUrl, authedFetch } from "../lib/api";

interface FileUploadProps {
  chunkingConfig?: {
    strategy: "recursive" | "fixed";
    size: number;
    overlap: number;
    minChunkSize?: number;
  };
  onUploadComplete?: () => void;
}

export function FileUpload({
  chunkingConfig,
  onUploadComplete,
}: FileUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
    ];
    const lowerName = file.name.toLowerCase();
    const hasValidExt =
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md");

    if (!validTypes.includes(file.type) && !hasValidExt) {
      setUploadStatus("error");
      setErrorMessage("Supported: PDF, DOCX, TXT, MD");
      return;
    }

    setUploadStatus("uploading");
    setProgress(0);
    setErrorMessage("");

    const token = localStorage.getItem("google_token");

    try {
      const urlRes = await authedFetch("/upload-url", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });
      if (!urlRes.ok) {
        const errBody = await urlRes.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to get upload URL");
      }

      const {
        url: uploadUrl,
        filename,
        storageUri,
        storageMode,
      } = await urlRes.json();

      const targetUrl =
        storageMode === "local" ? getApiUrl(uploadUrl) : uploadUrl;
      const uploadHeaders: Record<string, string> = {
        "Content-Type": file.type || "application/octet-stream",
      };
      if (storageMode === "local") {
        if (token) {
          uploadHeaders.Authorization = `Bearer ${token}`;
        }
        if (import.meta.env.VITE_DEV_AUTH_BYPASS === "true") {
          uploadHeaders["x-dev-user-id"] = "local-dev-user";
        }
      }

      await axios.put(targetUrl, file, {
        headers: uploadHeaders,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || file.size)
          );
          setProgress(percent);
        },
      });

      setUploadStatus("processing");

      const ingestRes = await authedFetch("/documents/ingest", {
        method: "POST",
        body: JSON.stringify({
          filename,
          storageUri,
          fileSize: file.size,
          chunkingConfig,
        }),
      });

      if (!ingestRes.ok) {
        const errBody = await ingestRes.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to queue document ingestion");
      }

      setUploadStatus("success");
      toast.success("Uploaded and queued for indexing.");
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      const msg =
        error instanceof Error
          ? error.message
          : "Upload failed. Check console.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  return (
    <div
      className={cn(
        "border border-dashed rounded-lg p-4 transition-colors text-center relative cursor-pointer",
        uploadStatus === "idle" &&
          "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40",
        (uploadStatus === "uploading" || uploadStatus === "processing") &&
          "border-blue-500/60 bg-blue-500/5",
        uploadStatus === "success" && "border-emerald-500/50 bg-emerald-500/5",
        uploadStatus === "error" && "border-red-500/50 bg-red-500/5"
      )}
    >
      <input
        type="file"
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFileChange}
        disabled={
          uploadStatus === "uploading" || uploadStatus === "processing"
        }
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
      />

      <div className="flex items-center justify-center gap-2.5 text-xs">
        {uploadStatus === "idle" && (
          <>
            <Upload className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-300 font-medium">
              Upload document
            </span>
            <span className="text-zinc-500 font-mono">PDF, DOCX, TXT, MD</span>
          </>
        )}

        {uploadStatus === "uploading" && (
          <>
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-blue-400 font-mono tabular-nums">
              Uploading {progress}%
            </span>
          </>
        )}

        {uploadStatus === "processing" && (
          <>
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-amber-400">Queuing ingestion...</span>
          </>
        )}

        {uploadStatus === "success" && (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">Queued for indexing</span>
          </>
        )}

        {uploadStatus === "error" && (
          <>
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-red-300 truncate">{errorMessage}</span>
          </>
        )}
      </div>
    </div>
  );
}

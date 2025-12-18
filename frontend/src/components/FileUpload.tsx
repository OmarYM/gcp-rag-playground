import { useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
      setErrorMessage("Supported formats: PDF, DOCX, TXT, MD");
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
      toast.success("File uploaded and queued for ingestion.");
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
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-6 transition-all duration-200 text-center relative overflow-hidden group",
          uploadStatus === "idle"
            ? "border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/50"
            : "",
          uploadStatus === "uploading" || uploadStatus === "processing"
            ? "border-indigo-500/50 bg-indigo-500/5"
            : "",
          uploadStatus === "success"
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "",
          uploadStatus === "error" ? "border-red-500/50 bg-red-500/5" : ""
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

        <div className="flex flex-col items-center justify-center gap-2 relative z-0">
          {uploadStatus === "idle" && (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-medium text-slate-300">
                  Click to upload
                </span>{" "}
                (PDF, DOCX, TXT, MD)
              </div>
            </>
          )}

          {uploadStatus === "uploading" && (
            <>
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="text-xs font-medium text-indigo-400">
                Uploading... {progress}%
              </div>
            </>
          )}

          {uploadStatus === "processing" && (
            <>
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <div className="text-xs font-medium text-amber-400">
                Queuing Ingestion...
              </div>
            </>
          )}

          {uploadStatus === "success" && (
            <>
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-xs font-medium text-emerald-400">
                Queued for indexing!
              </div>
            </>
          )}

          {uploadStatus === "error" && (
            <>
              <AlertCircle className="w-8 h-8 text-red-400" />
              <div className="text-xs text-red-300">{errorMessage}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

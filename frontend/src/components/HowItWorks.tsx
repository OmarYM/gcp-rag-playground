import { X } from "lucide-react";

interface HowItWorksProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorks({ isOpen, onClose }: HowItWorksProps) {
  if (!isOpen) return null;

  const steps = [
    {
      label: "1. Upload",
      detail:
        "Files (PDF, DOCX, TXT, MD) are uploaded via a GCS signed URL or local disk endpoint under users/{userId}/.",
    },
    {
      label: "2. Queue",
      detail:
        "POST /documents/ingest publishes an event to Cloud Pub/Sub (or runs inline in local dev) and returns 202 Accepted.",
    },
    {
      label: "3. Index",
      detail:
        "The ingestion worker extracts text, chunks it, generates 768-d embeddings, and writes document_chunks in PostgreSQL.",
    },
    {
      label: "4. Retrieve & Stream",
      detail:
        "POST /chat embeds the query, runs top-5 cosine similarity (<=>) filtered by user_id, and streams tokens + sources via SSE.",
    },
  ];

  const stack = [
    ["Frontend", "React, TypeScript, Vite, Tailwind CSS"],
    ["Backend", "Node.js, Express, TypeScript"],
    ["Database", "PostgreSQL 15 + pgvector (HNSW)"],
    ["Queue & Storage", "Cloud Pub/Sub + GCS (or inline + local disk)"],
    ["Models", "Gemini (Vertex AI or Gemini Developer API)"],
    ["Infrastructure", "Terraform (VPC, Cloud SQL, Cloud Run, IAM)"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">
            Pipeline & Stack
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6 text-sm">
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Request Flow
            </h3>
            <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-md">
              {steps.map((s) => (
                <div key={s.label} className="p-3 space-y-1">
                  <div className="text-xs font-mono text-zinc-200">
                    {s.label}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {s.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Components
            </h3>
            <div className="border border-zinc-800 rounded-md divide-y divide-zinc-800">
              {stack.map(([k, v]) => (
                <div
                  key={k}
                  className="px-3 py-2 flex items-center justify-between gap-4 text-xs"
                >
                  <span className="font-mono text-zinc-400">{k}</span>
                  <span className="text-zinc-200 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

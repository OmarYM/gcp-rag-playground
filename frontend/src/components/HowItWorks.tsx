import {
  X,
  Server,
  Database,
  Brain,
  Lock,
  FileText,
  Zap,
  Cloud,
  Box,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";

interface HowItWorksProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowItWorks({ isOpen, onClose }: HowItWorksProps) {
  if (!isOpen) return null;

  const techStack = [
    {
      icon: <Brain className="text-purple-400" />,
      title: "Gemini 2.0 Flash",
      desc: "State-of-the-art multimodal AI for reasoning and generation.",
    },
    {
      icon: <Database className="text-indigo-400" />,
      title: "Cloud SQL (pgvector)",
      desc: "PostgreSQL with vector embeddings for high-dimensional semantic search.",
    },
    {
      icon: <Server className="text-emerald-400" />,
      title: "Google Cloud Run",
      desc: "Serverless containerized backend ensuring auto-scaling and security.",
    },
    {
      icon: <Lock className="text-amber-400" />,
      title: "User-Scoped Isolation",
      desc: "Authenticated queries filter documents and vector chunks by user ID at the database query boundary.",
    },
    {
      icon: <Zap className="text-blue-400" />,
      title: "Real-time Streaming",
      desc: "Server-Sent Events (SSE) for instant token streaming and context transparency.",
    },
    {
      icon: <Cloud className="text-sky-400" />,
      title: "Cloud Storage",
      desc: "Robust object storage for raw document retention.",
    },
    {
      icon: <Box className="text-orange-400" />,
      title: "Terraform IaC",
      desc: "Complete infrastructure definition as code for reproducible deployments.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200 custom-scrollbar">
        {/* Header */}
        <div className="top-0 bg-slate-900/95 backdrop-blur z-10 p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              System Architecture
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Personal cloud-native RAG (Retrieval-Augmented Generation) playground.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-12">
          {/* Why RAG? */}
          <section>
            <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" /> Why use RAG?
            </h3>
            <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-6">
              <p className="text-slate-300 leading-relaxed mb-8">
                Retrieval-Augmented Generation (RAG) is a technique that
                enhances Large Language Models (LLMs) by allowing them to
                reference authoritative knowledge bases outside their training
                data before generating a response. This allows you to "chat"
                with your own private documents without training a new model.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Benefit
                  title="Ground Responses in Documents"
                  desc="By retrieving relevant passages from your uploaded files, the model can cite specific source chunks."
                />
                <Benefit
                  title="Private Data Access"
                  desc="Securely leverage your proprietary data while keeping it isolated from public model training."
                />
                <Benefit
                  title="Source Attribution"
                  desc="Every answer can be traced back to specific chunks of text in your uploaded files for verification."
                />
                <Benefit
                  title="Cost-Effective Intelligence"
                  desc="Avoid the massive compute costs of fine-tuning models. Just index your data and query it."
                />
              </div>
            </div>
          </section>
          {/* The Workflow */}
          <section>
            <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" /> How It Works
            </h3>
            <div className="relative">
              <div className="space-y-8">
                <Step
                  number="1"
                  title="Secure Ingestion"
                  desc="Documents are uploaded securely to Google Cloud Storage via signed URLs. Security rules enforce file size and count limits."
                />
                <Step
                  number="2"
                  title="Event-Driven Processing"
                  desc="A Pub/Sub webhook triggers the processing pipeline. The backend parses PDFs (handling V2/Uint8Array quirks) and chunks text."
                />
                <Step
                  number="3"
                  title="Vector Embedding"
                  desc="Chunks are converted into 768-dimensional vectors using Gemini's embedding model and stored in Cloud SQL with HNSW indexes."
                />
                <Step
                  number="4"
                  title="Sematic Search & Generation"
                  desc="User queries utilize cosine similarity search to find relevant context. This context is fed to Gemini 2.0 Flash for grounded, accurate answers."
                />
              </div>
            </div>
          </section>

          {/* Infrastructure & Deployment */}
          <section>
            <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
              <Box className="w-5 h-5 text-orange-400" /> Automated Deployment
            </h3>
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-6 relative overflow-hidden group hover:border-orange-500/30 transition-colors">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Server className="w-40 h-40 text-indigo-500 transform rotate-12" />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="flex-1">
                  <p className="text-slate-300 mb-4 leading-relaxed">
                    The entire infrastructure is defined in{" "}
                    <span className="text-orange-400 font-semibold">
                      Terraform
                    </span>
                    , managing Cloud Run services, SQL instances, Pub/Sub
                    topics, and IAM roles.
                  </p>
                  <div className="bg-black/50 rounded-lg p-3 border border-slate-800 font-mono text-sm inline-block shadow-inner">
                    <span className="text-green-400 font-bold">
                      ./deploy.ps1
                    </span>{" "}
                    <span className="text-slate-500 italic">
                      # 1-click build & deploy
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tech Stack Grid */}
          <section>
            <h3 className="text-lg font-semibold text-slate-200 mb-6">
              Powered By
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {techStack.map((tech, i) => (
                <div
                  key={i}
                  className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors group"
                >
                  <div className="mb-3 p-2 bg-slate-900 w-fit rounded-lg group-hover:scale-110 transition-transform">
                    {tech.icon}
                  </div>
                  <h4 className="font-medium text-slate-200 mb-1">
                    {tech.title}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {tech.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  desc,
}: {
  number: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-4 relative z-10">
      <div className="flex-none w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-300 shadow-xl">
        {number}
      </div>
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800/50 flex-1 hover:bg-slate-800 transition-colors">
        <h4 className="font-medium text-indigo-300 mb-1">{title}</h4>
        <p className="text-sm text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function Benefit({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex-none">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      </div>
      <div>
        <h4 className="font-medium text-slate-200 text-sm">{title}</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

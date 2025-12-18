import { useState, ReactNode } from "react";
import { Upload, MessageSquare, Menu, X, LogOut } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "./AuthProvider";

interface LayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  rightPanel: ReactNode;
}

export function Layout({ children, sidebar, rightPanel }: LayoutProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showUploads, setShowUploads] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Settings Overlay */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/50 z-20"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* LEFT SIDEBAR (Settings) */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-80 bg-slate-900/95 backdrop-blur border-r border-slate-800 transition-transform duration-300 ease-in-out",
          showSettings ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-indigo-400">
            <MessageSquare className="w-6 h-6" />
            <span className="">RAG Playground</span>
          </div>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 hover:bg-slate-800 rounded-md text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">{sidebar}</div>

        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="bg-indigo-500/10 rounded-lg p-4 border border-indigo-500/20">
            <h3 className="text-sm font-medium text-indigo-300 mb-1">
              Connected to GCP
            </h3>
            <p className="text-xs text-slate-400">
              Project: gcp-rag-playground
            </p>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
          <div className="flex items-center gap-3">
            {/* Menu Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 -ml-2 hover:bg-slate-800 rounded-lg text-slate-400"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg text-slate-200 truncate">
              Chat Session
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload Button */}
            <button
              onClick={() => setShowUploads(!showUploads)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all border",
                showUploads
                  ? "bg-slate-800 border-slate-700 text-indigo-400"
                  : "bg-indigo-600 hover:bg-indigo-500 border-transparent text-white shadow-lg shadow-indigo-500/20"
              )}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline font-medium text-sm">
                Upload Documents
              </span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">{children}</div>
      </div>

      {/* RIGHT SIDEBAR (Uploads & Chunking) */}
      {showUploads && (
        <div
          className="fixed inset-0 z-20 xl:hidden"
          onClick={() => setShowUploads(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-30 w-80 bg-slate-900/95 backdrop-blur border-l border-slate-800 transition-transform duration-300 ease-in-out xl:relative xl:transform-none xl:bg-slate-900/30",
          showUploads
            ? "translate-x-0 shadow-2xl"
            : "translate-x-full xl:hidden"
        )}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-400" />
            Documents
          </h2>
          <button
            onClick={() => setShowUploads(false)}
            className="xl:hidden p-2 hover:bg-slate-800 rounded-md text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">{rightPanel}</div>
      </div>
    </div>
  );
}

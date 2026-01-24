import { useState } from "react";
import { useAuth } from "./components/AuthProvider";
import { FileUpload } from "./components/FileUpload";
import { ChatInterface } from "./components/ChatInterface";
import { FileList } from "./components/FileList";
import { UsageStats } from "./components/UsageStats";
import { HowItWorks } from "./components/HowItWorks";
import {
  ChunkingSettings,
  ChunkingConfig,
} from "./components/ChunkingSettings";
import { SettingsPanel } from "./components/SettingsPanel";
import { Modal } from "./components/Modal";
import { LogOut, Menu, X, Info, SlidersHorizontal } from "lucide-react";
import { Toaster } from "sonner";

function App() {
  const { user, logout } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chunkingConfig, setChunkingConfig] = useState<ChunkingConfig>({
    strategy: "recursive",
    size: 1000,
    overlap: 200,
    minChunkSize: 50,
  });

  const [systemInstruction, setSystemInstruction] = useState(
    `Answer the user's question using the provided Context.\n- Cite source filenames when referencing retrieved passages.\n- If the Context does not contain the answer, state that clearly before offering any general knowledge.`
  );

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-1.5 hover:bg-zinc-900 rounded-md transition-colors text-zinc-400"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-mono text-sm font-medium tracking-tight text-zinc-100">
              gcp-rag-playground
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
              Settings
            </button>
            <button
              onClick={() => setIsHowItWorksOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800 transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-zinc-400" />
              Pipeline
            </button>

            {user?.email && (
              <span className="hidden md:inline-block text-xs font-mono text-zinc-400 border-l border-zinc-800 pl-3 ml-1">
                {user.email}
              </span>
            )}
            <button
              onClick={logout}
              className="p-1.5 hover:bg-zinc-900 rounded-md transition-colors text-zinc-400 hover:text-zinc-100"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto flex-1 flex h-[calc(100vh-56px)] overflow-hidden">
        <aside
          className={`
            fixed inset-y-0 left-0 w-80 bg-zinc-950 border-r border-zinc-800 p-4 transform transition-transform duration-200 z-30
            lg:relative lg:transform-none lg:w-80 lg:block
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <div className="flex flex-col h-full gap-4">
            <div className="lg:hidden flex justify-between items-center pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsHowItWorksOpen(true)}
                  className="text-xs font-medium text-zinc-300"
                >
                  Pipeline
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-xs font-medium text-zinc-300"
                >
                  Settings
                </button>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-none">
              <FileUpload
                onUploadComplete={handleUploadComplete}
                chunkingConfig={chunkingConfig}
              />
            </div>

            <div className="flex-none">
              <UsageStats refreshTrigger={refreshTrigger} />
            </div>

            <div className="flex-1 min-h-0">
              <FileList
                refreshTrigger={refreshTrigger}
                onDelete={handleUploadComplete}
              />
            </div>
          </div>
        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 overflow-hidden">
          <ChatInterface systemInstruction={systemInstruction} />
        </div>
      </main>

      <HowItWorks
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />

      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
      >
        <div className="space-y-6">
          <SettingsPanel
            systemInstruction={systemInstruction}
            onSystemInstructionChange={setSystemInstruction}
          />
          <ChunkingSettings
            config={chunkingConfig}
            onConfigChange={setChunkingConfig}
          />
        </div>
      </Modal>

      <Toaster position="top-center" theme="dark" />
    </div>
  );
}

export default App;

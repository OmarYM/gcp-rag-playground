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
import { LogOut, Menu, X, HelpCircle, Settings } from "lucide-react";
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

  // System instruction for the RAG bot
  const [systemInstruction, setSystemInstruction] = useState(
    `You are a helpful and friendly AI assistant.
Your main task is to answer questions based on the provided documents.
1. Use the provided Context to answer the user's question.
2. If the answer is in the context, be detailed and cite the specific files if possible.
3. If the answer is NOT in the context, you may use your general knowledge to be helpful, but please mention that this information is outside the provided documents.
4. Maintain a conversational and professional tone.`
  );

  const handleUploadComplete = () => {
    console.log("Upload complete, refreshing list...");
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-slate-400" />
            </button>
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent text-xl font-bold tracking-tight">
              Omar's RAG Playground{" "}
              <span className="text-xs font-normal text-slate-500 ml-2 hidden sm:inline-block">
                v1.2
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 hover:bg-slate-800 text-xs font-medium text-indigo-300 border border-indigo-500/20 transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button
              onClick={() => setIsHowItWorksOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 hover:bg-slate-800 text-xs font-medium text-indigo-300 border border-indigo-500/20 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              How it Works
            </button>

            <div className="hidden md:block text-sm text-slate-400 border-l border-slate-800 pl-4">
              {user?.email}
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-red-400"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 flex gap-6 h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar (Desktop) */}
        <aside
          className={`
                    fixed inset-y-0 left-0 w-80 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 p-4 transform transition-transform duration-300 z-30
                    lg:relative lg:transform-none lg:bg-transparent lg:border-none lg:w-80 lg:p-0 lg:block
                    ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
        >
          <div className="flex flex-col h-full gap-4">
            <div className="lg:hidden flex justify-between items-center mb-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsHowItWorksOpen(true)}
                  className="flex items-center gap-2 text-xs font-medium text-indigo-400"
                >
                  <HelpCircle className="w-4 h-4" /> How it Works
                </button>
                <div className="h-4 w-px bg-slate-800" />
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-2 text-xs font-medium text-indigo-400"
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
              </div>
              <button onClick={() => setIsSidebarOpen(false)}>
                <X className="w-6 h-6 text-slate-400" />
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

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900/50 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
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

      <Toaster position="top-center" theme="dark" richColors />
    </div>
  );
}

export default App;

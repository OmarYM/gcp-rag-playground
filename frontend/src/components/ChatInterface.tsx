import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Send, User, Bot, Loader2, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "../lib/utils";
import { authedFetch } from "../lib/api";

interface SourceItem {
  filename: string;
  content: string;
}

interface Message {
  role: "user" | "model";
  content: string;
  sources?: SourceItem[];
  isSourcesOpen?: boolean;
}

interface ChatInterfaceProps {
  systemInstruction: string;
}

export function ChatInterface({ systemInstruction }: ChatInterfaceProps) {
  // const { token } = useAuth(); // Token is now handled by authedFetch
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      content: "Hello! I'm ready to answer questions about your documents.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewChat = () => {
    setMessages([
      {
        role: "model",
        content: "Hello! I'm ready to answer questions about your documents.",
      },
    ]);
    setInputValue("");
    toast.info("Chat conversation reset.");
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    if (inputValue.length > 2000) {
      toast.error("Message is too long. Max 2000 characters.");
      return;
    }

    const history = messages
      .filter((m) => m.role === "user" || m.role === "model")
      // Filter out the initial welcome message if needed, or keeping it is fine as long as logic handles it.
      // Actually backend expects {role: 'user'|'model', parts: [{text}]}
      // My state is {role: 'user'|'model', content: string}
      .slice(1) // Skip the first "Hello!" message to avoid confusing the model? Or keep it? keeping it is usually fine but it's a static string. Safer to skip if it's just a placeholder.
      .map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

    const userMessage = { role: "user" as const, content: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    // setSources([]); // Global state removed
    setIsLoading(true);

    try {
      console.log("Starting stream...");
      const response = await authedFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          query: inputValue,
          systemInstruction: systemInstruction || undefined,
          history: history,
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseText = "";

      // Add initial AI placeholder
      setMessages((prev) => [...prev, { role: "model" as const, content: "" }]);

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep incomplete chunk

        for (const block of lines) {
          if (!block.trim()) continue;

          const blockLines = block.split("\n");
          let isContext = false;
          let contextData = null;

          for (const line of blockLines) {
            if (line.startsWith("event: context")) {
              isContext = true;
            } else if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6);
              if (isContext) {
                try {
                  contextData = JSON.parse(jsonStr);
                } catch (e) {
                  console.error("Bad context json", e);
                }
              } else {
                // Token data
                try {
                  const payload = JSON.parse(jsonStr);
                  if (payload.token) {
                    aiResponseText += payload.token;
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      const lastMsg = newMessages[newMessages.length - 1];
                      newMessages[newMessages.length - 1] = {
                        role: "model",
                        content: aiResponseText,
                        // Preserve existing sources and open state
                        sources: lastMsg.sources,
                        isSourcesOpen: lastMsg.isSourcesOpen,
                      };
                      return newMessages;
                    });
                  }
                } catch (e) {}
              }
            }
          }

          if (isContext && contextData) {
            setMessages((prev) => {
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              if (lastMsg.role === "model") {
                newMessages[newMessages.length - 1] = {
                  ...lastMsg,
                  sources: contextData.map((c: any) => ({
                    filename: c.filename,
                    content: c.content,
                  })),
                  isSourcesOpen: false,
                };
              }
              return newMessages;
            });
          }
        }
      }

      console.log("Stream finished.");
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content:
            "Error: Something went wrong communicating with the backend.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-none p-4 border-b border-slate-800 flex justify-end">
        <button
          onClick={handleNewChat}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors border border-slate-700 hover:border-slate-600"
          title="Reset conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "flex gap-4 max-w-3xl",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                msg.role === "user"
                  ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400"
                  : "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
              )}
            >
              {msg.role === "user" ? (
                <User className="w-5 h-5" />
              ) : (
                <Bot className="w-5 h-5" />
              )}
            </div>

            <div
              className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[85%] prose prose-invert prose-sm max-w-none",
                msg.role === "user"
                  ? "bg-slate-800 text-slate-100 rounded-tr-none"
                  : "bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none"
              )}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>

              {/* Context Sources for Model Messages */}
              {msg.role === "model" && (msg?.sources?.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => {
                        setMessages((prev) => {
                          const newMsgs = [...prev];
                          newMsgs[idx] = {
                            ...newMsgs[idx],
                            isSourcesOpen: !newMsgs[idx].isSourcesOpen,
                          };
                          return newMsgs;
                        });
                      }}
                      className="text-xs font-medium text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
                    >
                      {msg.isSourcesOpen ? "Hide" : "Show"}{" "}
                      {msg.sources?.length || 0} Sources
                    </button>
                  </div>

                  {msg.isSourcesOpen && (
                    <div className="mt-2 space-y-2">
                      {(msg.sources || []).map((src, i) => (
                        <div
                          key={i}
                          className="bg-slate-950 p-2 rounded text-xs text-slate-400 border border-slate-800"
                        >
                          <p className="line-clamp-3">
                            <strong>{src.filename}:</strong> {src.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 mr-auto max-w-3xl">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-slate-400 text-sm">
              <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></span>
              <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></span>
              <span
                className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 backdrop-blur">
        <div className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Ask a question about your documents..."
            disabled={isLoading}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-4 pr-12 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-slate-600">
            AI can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}

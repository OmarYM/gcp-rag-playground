import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Send, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "../lib/utils";
import { authedFetch } from "../lib/api";

interface SourceItem {
  filename: string;
  content: string;
  chunk_index?: number;
  score?: number;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
    toast.info("Conversation cleared.");
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    if (inputValue.length > 2000) {
      toast.error("Message is too long. Max 2000 characters.");
      return;
    }

    const history = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const queryText = inputValue;
    setMessages((prev) => [...prev, { role: "user", content: queryText }]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await authedFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          query: queryText,
          systemInstruction: systemInstruction || undefined,
          history,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseText = "";

      setMessages((prev) => [...prev, { role: "model", content: "" }]);

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;

          const blockLines = block.split("\n");
          let eventType: "context" | "error" | "message" = "message";
          let contextData = null;

          for (const line of blockLines) {
            if (line.startsWith("event: context")) {
              eventType = "context";
            } else if (line.startsWith("event: error")) {
              eventType = "error";
            } else if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6);
              if (eventType === "context") {
                try {
                  contextData = JSON.parse(jsonStr);
                } catch (e) {
                  console.error("Bad context json", e);
                }
              } else if (eventType === "error") {
                const errPayload = JSON.parse(jsonStr);
                throw new Error(errPayload.error || "Stream interrupted");
              } else {
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
                        sources: lastMsg.sources,
                        isSourcesOpen: lastMsg.isSourcesOpen,
                      };
                      return newMessages;
                    });
                  }
                } catch {
                  // Ignore partial JSON frames
                }
              }
            }
          }

          if (eventType === "context" && Array.isArray(contextData)) {
            setMessages((prev) => {
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              if (lastMsg?.role === "model") {
                newMessages[newMessages.length - 1] = {
                  ...lastMsg,
                  sources: contextData.map((c: SourceItem) => ({
                    filename: c.filename,
                    content: c.content,
                    chunk_index: c.chunk_index,
                    score: c.score,
                  })),
                  isSourcesOpen: false,
                };
              }
              return newMessages;
            });
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message.");
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: "Error: Failed to retrieve or generate a response.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none px-6 py-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-mono">
          top-k=5 · cosine similarity
        </span>
        <button
          onClick={handleNewChat}
          disabled={messages.length === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-zinc-500">
              Upload a document on the left, then ask a question below.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "max-w-3xl",
              msg.role === "user" ? "ml-auto" : "mr-auto w-full"
            )}
          >
            <div className="text-[11px] font-mono text-zinc-500 mb-1.5">
              {msg.role === "user" ? "you" : "assistant"}
            </div>

            <div
              className={cn(
                "rounded-lg text-sm leading-relaxed prose prose-invert prose-sm max-w-none",
                msg.role === "user"
                  ? "bg-zinc-800/80 text-zinc-100 px-4 py-2.5"
                  : "bg-zinc-900/50 border border-zinc-800 text-zinc-200 px-4 py-3"
              )}
            >
              <ReactMarkdown>{msg.content}</ReactMarkdown>

              {msg.role === "model" && (msg?.sources?.length ?? 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800">
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
                    className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
                  >
                    {msg.isSourcesOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    {msg.sources?.length || 0} retrieved{" "}
                    {msg.sources?.length === 1 ? "source" : "sources"}
                  </button>

                  {msg.isSourcesOpen && (
                    <div className="mt-2.5 space-y-2">
                      {(msg.sources || []).map((src, i) => (
                        <div
                          key={i}
                          className="bg-zinc-950 p-2.5 rounded-md text-xs text-zinc-400 border border-zinc-800"
                        >
                          <div className="flex items-center justify-between font-mono text-[11px] text-zinc-300 mb-1">
                            <span>
                              {src.filename}
                              {typeof src.chunk_index === "number"
                                ? `#${src.chunk_index}`
                                : ""}
                            </span>
                            {typeof src.score === "number" && (
                              <span className="text-zinc-500 tabular-nums">
                                score {src.score.toFixed(3)}
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-3 text-zinc-400 m-0">
                            {src.content}
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
          <div className="text-xs font-mono text-zinc-500">
            Retrieving context and streaming response...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-3xl mx-auto relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Ask a question about your uploaded documents..."
            disabled={isLoading}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 pl-4 pr-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

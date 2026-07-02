"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface InteractiveChatProps {
  workflowId?: string;
  clientId?: string;
  businessName?: string;
  className?: string;
}

/**
 * Interactive chat component that calls /api/agent/chat to get AI responses
 * using the knowledge loaded in the workflow.
 *
 * This is used inside the WhatsApp simulator panel so the admin can test
 * questions and see how the Agente IA responds with real business data.
 */
export function InteractiveChat({
  workflowId,
  clientId,
  businessName,
  className,
}: InteractiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `¡Hola! 👋 Bienvenido a ${businessName || "nuestro negocio"}. ¿En qué puedo ayudarte?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    const message = input.trim();
    if (!message || loading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          businessName,
          workflowId,
          clientId,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const aiResponse = data.ai_response || "Lo siento, no pude procesar tu mensaje.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: aiResponse,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error de conexión. Intenta de nuevo.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pf-scroll space-y-2 p-3 bg-[#e5ddd5]"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm",
                msg.role === "user"
                  ? "bg-[#dcf8c6] text-gray-900"
                  : "bg-white text-gray-900"
              )}
            >
              <p className="whitespace-pre-wrap break-words leading-snug">
                {msg.content}
              </p>
              <span className="text-[8px] text-gray-500 block text-right mt-0.5">
                {format(msg.timestamp, "HH:mm")}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-3 py-2 shadow-sm">
              <Loader2 className="size-3 animate-spin text-gray-500" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-2 bg-[#f0f0f0] border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Escribe un mensaje…"
          className="flex-1 h-8 text-sm bg-white rounded-full border-0"
          disabled={loading}
        />
        <Button
          size="icon"
          className="size-8 rounded-full bg-[#075e54] hover:bg-[#054c44] shrink-0"
          onClick={send}
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

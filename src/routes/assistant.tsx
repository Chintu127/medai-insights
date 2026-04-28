import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "Assistant — MedAI" },
      { name: "description", content: "Chat with MedAI for medically-literate, educational answers." },
      { property: "og:title", content: "Assistant — MedAI" },
      { property: "og:description", content: "Streaming medical chat assistant — educational use only." },
    ],
  }),
  component: AssistantPage,
  errorComponent: ({ error, reset }) => (
    <div className="px-4 md:px-10 py-16 max-w-2xl mx-auto text-center space-y-4">
      <div className="size-14 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold">Assistant error</h1>
      <p className="text-sm text-muted-foreground break-words">{error.message}</p>
      <button onClick={reset} className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
        Try again
      </button>
    </div>
  ),
});

type Msg = { role: "user" | "assistant"; content: string };

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm MedAI Assistant. I can explain medical terms, lab values and conditions in plain language. **I'm not a doctor** and I don't diagnose. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;
      let appended = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) {
              acc += c;
              if (!appended) {
                appended = true;
                setMessages((m) => [...m, { role: "assistant", content: acc }]);
              } else {
                setMessages((m) => {
                  const copy = [...m];
                  copy[copy.length - 1] = { role: "assistant", content: acc };
                  return copy;
                });
              }
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
      if (!appended) {
        setMessages((m) => [...m, { role: "assistant", content: "(no response)" }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="px-4 md:px-10 py-5 border-b border-border">
        <h1 className="font-display text-xl md:text-2xl font-semibold">Medical Assistant</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Educational answers only — never a diagnosis or prescription.
        </p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 space-y-4">
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3 flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </div>
      <div className="border-t border-border bg-card/50 backdrop-blur p-3 md:p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about a symptom, lab value, condition…"
            rows={1}
            className="flex-1 resize-none rounded-xl bg-background border border-input px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-40"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="size-11 shrink-0 rounded-xl gradient-primary text-white flex items-center justify-center disabled:opacity-50 glow"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`size-8 shrink-0 rounded-xl flex items-center justify-center ${
          isUser ? "bg-primary text-primary-foreground" : "gradient-primary text-white"
        }`}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "glass-card rounded-tl-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

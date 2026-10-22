"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { trackConversion } from "@/lib/analytics-client";

/**
 * The site-wide assistant.
 *
 * Deliberately not the embeddable customer widget: that script needs a
 * `data-chatbot` and `data-token`, and mounting it without them made this
 * component fail silently on every page. This one talks to a same-origin
 * endpoint grounded in the site's own services, packages, and FAQs, with a
 * strict per-visitor budget.
 *
 * The fallback path is part of the feature, not an error state: when the model
 * is unavailable the panel becomes a clear route to a person.
 */

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "What would a new website cost?",
  "Can you build an AI chatbot for my site?",
  "How quickly can you launch an MVP?",
];

export function SiteAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [offline, setOffline] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  async function ask(question: string) {
    const prompt = question.trim();
    if (!prompt || pending) return;

    setMessages((current) => [...current, { role: "user", text: prompt }]);
    setInput("");
    setPending(true);

    try {
      const response = await fetch("/api/site-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        text?: string;
        message?: string;
        fallback?: boolean;
      };

      if (data.ok && data.text) {
        setMessages((current) => [
          ...current,
          { role: "assistant", text: data.text! },
        ]);
      } else {
        setOffline(Boolean(data.fallback));
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text:
              data.message ??
              "That did not go through. Book a call or email us and a person will reply.",
          },
        ]);
      }
    } catch {
      setOffline(true);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "The connection dropped. You can still book a call or email us directly.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            trackConversion("assistant_open", pathname);
          }}
          className="border-border bg-card text-foreground hover:border-primary fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium shadow-lg transition-colors"
          aria-label="Open the Bitecodes assistant"
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          Ask us anything
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Bitecodes assistant"
          className="border-border bg-card fixed right-4 bottom-4 z-50 flex h-[min(32rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
        >
          <header className="border-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Bitecodes assistant</p>
              <p className="text-muted-foreground text-xs">
                Answers from this site. A person replies on a call.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="text-muted-foreground hover:text-foreground rounded p-1"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  Ask about a project, a price, or how we work. For a firm
                  number, book the free 30-minute call.
                </p>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="border-border hover:border-primary w-full rounded-xl border px-3 py-2 text-left text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-2xl px-3 py-2 text-sm"
                    : "bg-muted text-foreground max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed"
                }
              >
                {message.text}
              </div>
            ))}

            {pending && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                Thinking…
              </div>
            )}

            {(offline || messages.length > 0) && (
              <div className="border-border flex flex-wrap gap-2 border-t pt-3">
                <Link
                  href="/book-a-call"
                  className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-xs font-medium"
                  onClick={() => setOpen(false)}
                >
                  Book a free call
                </Link>
                <Link
                  href="/contact"
                  className="border-border rounded-full border px-3 py-1.5 text-xs font-medium"
                  onClick={() => setOpen(false)}
                >
                  Send a message
                </Link>
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
            className="border-border flex items-center gap-2 border-t px-3 py-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={600}
              placeholder="Ask a question…"
              aria-label="Your question"
              className="border-border focus-outline min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Send question"
              className="bg-primary text-primary-foreground rounded-xl p-2 disabled:opacity-40"
            >
              <Send aria-hidden="true" className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

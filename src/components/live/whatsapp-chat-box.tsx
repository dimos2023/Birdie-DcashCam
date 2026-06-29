"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { MessageCircle, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { sendWhatsappMessage } from "@/lib/actions";
import type { WhatsappConversation, WhatsappMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_REPLIES = [
  "Your vehicle location has been shared.",
  "Please contact Birdie support for assistance.",
  "Trip completed successfully.",
  "Live camera stream is now available.",
  "We are monitoring your vehicle in real time.",
];

interface WhatsappChatBoxProps {
  conversation?: WhatsappConversation | null;
  messages: WhatsappMessage[];
  customerPhone?: string | null;
  customerName?: string | null;
}

export function WhatsappChatBox({
  conversation,
  messages: initialMessages,
  customerPhone,
  customerName,
}: WhatsappChatBoxProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const displayPhone =
    conversation?.wa_phone_number ?? customerPhone ?? null;
  const displayName =
    conversation?.contact_name ?? customerName ?? displayPhone ?? "Customer";

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (body: string) => {
    if (!body.trim() || !conversation) return;

    const trimmed = body.trim();
    setText("");

    const optimistic: WhatsappMessage = {
      id: `temp-${Date.now()}`,
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      direction: "outbound",
      body: trimmed,
      wa_message_id: null,
      status: "sending",
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);

    startTransition(async () => {
      try {
        await sendWhatsappMessage(conversation.id, trimmed);
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, status: "failed" } : m))
        );
      }
    });
  };

  const handleSend = () => sendMessage(text);

  if (!conversation && !displayPhone) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-xl border bg-white p-6 text-center shadow-sm">
        <MessageCircle className="h-10 w-10 text-[#3B8ECC]" />
        <p className="mt-3 font-medium text-[#1C3664]">No WhatsApp contact</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Link a customer phone number to start messaging
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-xl border bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[#1C3664]">{displayName}</p>
          {displayPhone && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{displayPhone}</span>
            </div>
          )}
        </div>
        <Badge className="shrink-0 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/10">
          WhatsApp
        </Badge>
      </div>

      {!conversation && (
        <div className="border-b bg-[#F2F8FC] px-4 py-2 text-xs text-muted-foreground">
          Conversation not started — messages will be enabled once a WhatsApp thread is linked.
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet. Send a quick reply below.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.direction === "outbound" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                  msg.direction === "outbound"
                    ? "rounded-br-md bg-[#1C3664] text-white"
                    : "rounded-bl-md bg-[#F2F8FC] text-[#1C1C1C]"
                )}
              >
                <p>{msg.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    msg.direction === "outbound" ? "text-white/60" : "text-muted-foreground"
                  )}
                >
                  {format(new Date(msg.sent_at), "HH:mm")}
                  {msg.status === "failed" && " · Failed"}
                  {msg.status === "sending" && " · Sending"}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {conversation && (
        <>
          <div className="border-t bg-[#F2F8FC]/50 px-3 py-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Quick replies</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => sendMessage(reply)}
                  disabled={isPending}
                  className="rounded-full border border-[#d4e4f0] bg-white px-2.5 py-1 text-xs text-[#1C3664] transition-colors hover:border-[#3B8ECC] hover:bg-[#F2F8FC] disabled:opacity-50"
                >
                  {reply.length > 36 ? `${reply.slice(0, 36)}…` : reply}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t p-3">
            <Input
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={isPending}
              className="min-w-0"
            />
            <Button
              onClick={handleSend}
              disabled={isPending || !text.trim()}
              className="shrink-0 bg-[#25D366] hover:bg-[#20BD5A]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

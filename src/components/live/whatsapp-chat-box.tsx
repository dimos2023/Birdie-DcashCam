"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { MessageCircle, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { WhatsappMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_REPLIES = [
  "Your vehicle location has been shared.",
  "Please contact Birdie support for assistance.",
  "Trip completed successfully.",
  "Live camera stream is now available.",
  "We are monitoring your vehicle in real time.",
];

interface WhatsappChatBoxProps {
  messages: WhatsappMessage[];
  customerPhone?: string | null;
  customerName?: string | null;
  isDemo?: boolean;
}

export function WhatsappChatBox({
  messages: initialMessages,
  customerPhone,
  customerName,
  isDemo = true,
}: WhatsappChatBoxProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const idCounter = useRef(0);

  const displayName = customerName ?? customerPhone ?? "Customer";

  const sendMessage = (body: string) => {
    if (!body.trim()) return;
    const trimmed = body.trim();
    setText("");
    setSending(true);

    idCounter.current += 1;
    const optimistic: WhatsappMessage = {
      id: `demo-out-${idCounter.current}`,
      organization_id: "",
      conversation_id: "demo",
      direction: "outbound",
      body: trimmed,
      wa_message_id: null,
      status: "sent",
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setSending(false);

    toast.info("Demo message sent", {
      description: "WhatsApp API integration coming soon.",
    });
  };

  return (
    <div className="flex h-full min-h-[400px] flex-col rounded-2xl border border-[#e8f2fa] bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-[#e8f2fa] px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[#1C3664]">{displayName}</p>
          {customerPhone && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-[#1C1C1C]/50">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{customerPhone}</span>
            </div>
          )}
        </div>
        <Badge className="shrink-0 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/10">
          WhatsApp
        </Badge>
      </div>

      {isDemo && (
        <div className="border-b border-[#e8f2fa] bg-[#F2F8FC] px-4 py-2 text-xs text-[#1C1C1C]/55">
          Placeholder chat — WhatsApp Cloud API not connected yet.
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
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
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                  msg.direction === "outbound"
                    ? "rounded-br-md bg-[#1C3664] text-white"
                    : "rounded-bl-md bg-[#F2F8FC] text-[#1C1C1C]"
                )}
              >
                <p>{msg.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    msg.direction === "outbound" ? "text-white/60" : "text-[#1C1C1C]/45"
                  )}
                >
                  {format(new Date(msg.sent_at), "HH:mm")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-[#e8f2fa] bg-[#F2F8FC]/50 px-3 py-2">
        <p className="mb-2 text-xs font-medium text-[#1C1C1C]/45">Quick replies</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => sendMessage(reply)}
              disabled={sending}
              className="rounded-full border border-[#d4e4f0] bg-white px-2.5 py-1 text-xs text-[#1C3664] transition-colors hover:border-[#3B8ECC] hover:bg-[#F2F8FC] disabled:opacity-50"
            >
              {reply.length > 36 ? `${reply.slice(0, 36)}…` : reply}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-t border-[#e8f2fa] p-3">
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(text)}
          disabled={sending}
          className="min-w-0 border-[#d4e4f0]"
        />
        <Button
          onClick={() => sendMessage(text)}
          disabled={sending || !text.trim()}
          className="shrink-0 bg-[#25D366] hover:bg-[#20BD5A]"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

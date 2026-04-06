import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Paperclip, X, FileText, Film, Image as ImageIcon, File } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  attachments?: Attachment[];
}

interface ChatWindowProps {
  bookingId: string;
  recipientId: string;
  recipientName: string;
  listingTitle: string;
  onBack?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = "image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />;
  if (type.startsWith("video/")) return <Film className="w-4 h-4" />;
  if (type.includes("pdf") || type.includes("doc") || type.includes("sheet") || type.includes("text"))
    return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ChatWindow = ({ bookingId, recipientId, recipientName, listingTitle, onBack }: ChatWindowProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch messages
  useEffect(() => {
    if (!user || !bookingId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      setMessages((data as unknown as Message[]) || []);
    };

    fetchMessages();

    // Mark unread messages as read
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("booking_id", bookingId)
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .then(() => {});

    // Realtime subscription
    const channel = supabase
      .channel(`messages:${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.recipient_id === user.id) {
            supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", newMsg.id)
              .then(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, bookingId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    setPendingFiles((prev) => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: File[]): Promise<Attachment[]> => {
    const attachments: Attachment[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/${bookingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("message-attachments")
        .upload(path, file, { contentType: file.type });
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(path);
      attachments.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }
    return attachments;
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !user || sending) return;
    setSending(true);
    setUploading(pendingFiles.length > 0);

    let attachments: Attachment[] = [];
    if (pendingFiles.length > 0) {
      attachments = await uploadFiles(pendingFiles);
    }

    const content = newMessage.trim() || (attachments.length > 0 ? `Sent ${attachments.length} file(s)` : "");
    if (!content && attachments.length === 0) {
      setSending(false);
      setUploading(false);
      return;
    }

    const { error } = await supabase.from("messages").insert({
      booking_id: bookingId,
      sender_id: user.id,
      recipient_id: recipientId,
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
    } as any);

    if (!error) {
      setNewMessage("");
      setPendingFiles([]);
    }
    setSending(false);
    setUploading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderAttachments = (attachments: Attachment[], isMine: boolean) => (
    <div className="flex flex-col gap-1.5 mt-1">
      {attachments.map((att, i) => {
        if (att.type.startsWith("image/")) {
          return (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
              <img
                src={att.url}
                alt={att.name}
                className="max-w-[240px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition"
              />
            </a>
          );
        }
        if (att.type.startsWith("video/")) {
          return (
            <video key={i} src={att.url} controls className="max-w-[240px] rounded-lg" preload="metadata" />
          );
        }
        return (
          <a
            key={i}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 p-2 rounded-lg text-xs hover:opacity-80 transition ${
              isMine ? "bg-primary-foreground/10" : "bg-muted"
            }`}
          >
            {getFileIcon(att.type)}
            <span className="truncate max-w-[160px]">{att.name}</span>
            <span className="text-[10px] opacity-60 shrink-0">{formatFileSize(att.size)}</span>
          </a>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h3 className="font-serif font-bold text-foreground truncate">{recipientName}</h3>
          <p className="text-xs text-muted-foreground truncate">{listingTitle}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const attachments = (msg.attachments as Attachment[] | undefined) || [];
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-secondary-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content && !(attachments.length > 0 && msg.content.match(/^Sent \d+ file\(s\)$/)) && (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  {attachments.length > 0 && renderAttachments(attachments, isMine)}
                  <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "h:mm a")}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="px-3 pt-2 flex gap-2 flex-wrap border-t border-border bg-card">
          {pendingFiles.map((file, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1 text-xs">
              {getFileIcon(file.type)}
              <span className="truncate max-w-[100px]">{file.name}</span>
              <button onClick={() => removePendingFile(i)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-card shrink-0">
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
            type="button"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Textarea
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={(!newMessage.trim() && pendingFiles.length === 0) || sending}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {uploading && (
          <p className="text-xs text-muted-foreground mt-1 animate-pulse">Uploading files...</p>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;

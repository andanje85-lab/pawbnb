import { useState } from "react";
import { Bell, BellOff, Check, CheckCheck, Dog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  permissionState: NotificationPermission;
  onRequestPermission: () => void;
}

const NotificationPanel = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  permissionState,
  onRequestPermission,
}: NotificationPanelProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            if (permissionState !== "granted") {
              e.preventDefault();
              onRequestPermission();
              return;
            }
          }}
        >
          {permissionState === "granted" ? (
            <Bell className="w-5 h-5 text-primary" />
          ) : (
            <BellOff className="w-5 h-5" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={onMarkAllRead}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Dog className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && onMarkRead(n.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {!n.is_read ? (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    ) : (
                      <div className="w-2 h-2" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-snug", !n.is_read ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationPanel;

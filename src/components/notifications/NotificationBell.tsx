import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, link_url, read_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setItems(data || []);
    };
    load();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) => [n, ...prev].slice(0, 30));
          toast(n.title, { description: n.body || undefined });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const unread = items.filter((i) => !i.read_at).length;

  async function markAllRead() {
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (!ids.length) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: new Date().toISOString() })));
  }

  async function markOneRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)));
  }

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center"
            >
              {unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</div>
        )}
        <div className="max-h-96 overflow-y-auto">
          {items.map((n) => {
            const content = (
              <div
                className={cn(
                  'px-3 py-2 text-sm border-l-2 cursor-pointer hover:bg-accent',
                  n.read_at ? 'border-transparent opacity-70' : 'border-primary bg-accent/30',
                )}
                onClick={() => {
                  if (!n.read_at) markOneRead(n.id);
                  setOpen(false);
                }}
              >
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            );
            return n.link_url ? (
              <Link key={n.id} to={n.link_url}>
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

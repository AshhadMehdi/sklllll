import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { useSocketEvent } from '@/lib/socket';
import { useAuth } from '@/stores/auth';
import type { ChatMessage, Order } from '@/lib/types';
import { cn, fmtTime } from '@/lib/utils';

export function ChatSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const { data: messages = [] } = useQuery({ queryKey: ['messages', order.id], queryFn: () => api.orders.messages(order.id), enabled: open });

  useSocketEvent<ChatMessage>('chat:message', (m) => {
    if (m.orderId !== order.id) return;
    qc.setQueryData<ChatMessage[]>(['messages', order.id], (old = []) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
  }, [order.id]);

  const send = useMutation({
    mutationFn: (body: string) => api.orders.sendMessage(order.id, body),
    onSuccess: (m) => {
      qc.setQueryData<ChatMessage[]>(['messages', order.id], (old = []) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
      setText('');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, open]);

  const roleLabel = (r: string) => ({ CUSTOMER: 'Customer', RUNNER: 'Rider', MERCHANT: 'Shop', ADMIN: 'Support' })[r] ?? r;
  const quick = me?.role === 'RUNNER' ? ['I have arrived 📍', 'On my way 🛵', 'Please share exact location', 'Running 5 min late'] : me?.role === 'CUSTOMER' ? ['Where are you?', 'Please call when you arrive', 'Leave at the gate', 'Thank you!'] : ['Order is being packed', 'Item out of stock — replace?', 'Rider is on the way'];

  return (
    <Sheet open={open} onClose={onClose} title={<span>Chat · <span className="text-slate-400">{order.orderNumber}</span></span>} size="tall" footer={
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(text.trim()); }} className="space-y-2">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {quick.map((q) => <button type="button" key={q} onClick={() => send.mutate(q)} className="chip border-slate-200 bg-slate-50 text-xs">{q}</button>)}
        </div>
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" className="field flex-1" />
          <button type="submit" disabled={!text.trim() || send.isPending} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white disabled:opacity-50"><Send className="h-5 w-5" /></button>
        </div>
      </form>
    }>
      <div className="space-y-3 py-2">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No messages yet. Say salam 👋</p>}
        {messages.map((m) => {
          const mine = m.senderId === me?.id;
          return (
            <div key={m.id} className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
              {!mine && <Avatar name={m.senderName} src={m.senderAvatar} size="sm" />}
              <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white ring-1 ring-slate-100')}>
                {!mine && <div className="mb-0.5 text-[11px] font-semibold text-brand-700">{m.senderName} · {roleLabel(m.senderRole)}</div>}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={cn('mt-0.5 text-[10px]', mine ? 'text-white/70' : 'text-slate-400')}>{fmtTime(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </Sheet>
  );
}

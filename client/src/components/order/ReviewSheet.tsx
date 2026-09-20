import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/Sheet';
import { Button, StarRating, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';

export function ReviewSheet({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [shopRating, setShopRating] = useState(5);
  const [runnerRating, setRunnerRating] = useState(5);
  const [comment, setComment] = useState('');
  const m = useMutation({
    mutationFn: () => api.orders.review(order.id, { shopRating, runnerRating: order.runner ? runnerRating : null, comment: comment || undefined }),
    onSuccess: (o) => {
      qc.setQueryData(['order', order.id], o);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Thanks for your feedback! 💚');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Rate your order" footer={<Button block size="lg" loading={m.isPending} onClick={() => m.mutate()}>Submit review</Button>}>
      <div className="space-y-5 py-2">
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
          <div className="text-sm text-slate-500">How was</div>
          <div className="text-lg font-bold">{order.shop.name}?</div>
          <div className="mt-2 flex justify-center"><StarRating value={shopRating} onChange={setShopRating} size="lg" /></div>
        </div>
        {order.runner && (
          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <div className="text-sm text-slate-500">And your rider</div>
            <div className="text-lg font-bold">{order.runner.name}?</div>
            <div className="mt-2 flex justify-center"><StarRating value={runnerRating} onChange={setRunnerRating} size="lg" /></div>
          </div>
        )}
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything the shop should know? (optional)" maxLength={500} />
      </div>
    </Sheet>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useLocation } from '@/stores/location';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, EmptyState, Skeleton } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { AddressForm } from './Checkout';
import type { Address } from '@/lib/types';

export default function Addresses() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { coords, setFromAddress } = useLocation();
  const q = useQuery({ queryKey: ['addresses'], queryFn: api.users.addresses });
  const [editing, setEditing] = useState<Address | 'new' | null>(params.get('new') ? 'new' : null);
  const [del, setDel] = useState<Address | null>(null);
  useEffect(() => { if (params.get('new')) setParams({}, { replace: true }); }, [params, setParams]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['addresses'] });
  const delM = useMutation({ mutationFn: (id: string) => api.users.deleteAddress(id), onSuccess: () => { refresh(); toast.success('Address removed'); } });
  const defM = useMutation({ mutationFn: (id: string) => api.users.updateAddress(id, { isDefault: true }), onSuccess: refresh });

  return (
    <div className="min-h-dvh">
      <PageHeader title="Saved addresses" back="/profile" action={<Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Add</Button>} />
      <div className="space-y-3 px-4 pt-4">
        {q.isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        {q.data?.length === 0 && <EmptyState emoji="📍" title="No addresses yet" description="Save your home and office so checkout takes seconds." action={<Button onClick={() => setEditing('new')}>Add address</Button>} />}
        {q.data?.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg">{/office|work/i.test(a.label) ? '🏢' : '🏠'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-bold">{a.label}{a.isDefault && <Badge tone="brand">Default</Badge>}</div>
                <div className="text-sm text-slate-600">{[a.line1, a.area, a.city].filter(Boolean).join(', ')}</div>
                {a.instructions && <div className="mt-0.5 text-xs text-slate-500">“{a.instructions}”</div>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" leftIcon={<MapPin className="h-3.5 w-3.5" />} onClick={() => { setFromAddress(a); toast.success(`Showing shops near ${a.label}`); }}>Shop near here</Button>
              {!a.isDefault && <Button size="sm" variant="outline" onClick={() => defM.mutate(a.id)}>Make default</Button>}
              <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(a)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-rose-600" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDel(a)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New address' : 'Edit address'} size="tall">
        {editing && <AddressForm initial={coords} existing={editing === 'new' ? undefined : editing} onSaved={() => { refresh(); setEditing(null); }} onCancel={() => setEditing(null)} />}
      </Sheet>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.label}?`} danger confirmLabel="Delete" onConfirm={() => delM.mutateAsync(del!.id).then(() => undefined)} />
    </div>
  );
}

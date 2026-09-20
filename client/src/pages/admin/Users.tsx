import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { Avatar, Badge, Button, Chip, EmptyState, Input, Select, Skeleton } from '@/components/ui';
import type { Role } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

const ROLES: (Role | 'all')[] = ['all', 'CUSTOMER', 'MERCHANT', 'RUNNER', 'ADMIN'];
const TONE: Record<Role, 'brand' | 'accent' | 'sky' | 'violet'> = { CUSTOMER: 'brand', MERCHANT: 'accent', RUNNER: 'sky', ADMIN: 'violet' };

export default function AdminUsers() {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role | 'all'>('all');
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['admin', 'users', role, q], queryFn: () => api.admin.users({ role: role === 'all' ? undefined : role, q: q || undefined }) });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isActive?: boolean; role?: string; walletPoints?: number } }) => api.admin.updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); toast.success('User updated'); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div>
      <DashHeader title="Users" subtitle="Customers, merchants and riders on the platform." />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input leftIcon={<Search className="h-4 w-4" />} placeholder="Search name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="md:max-w-xs" />
        <div className="flex gap-2 overflow-x-auto no-scrollbar">{ROLES.map((r) => <Chip key={r} active={role === r} onClick={() => setRole(r)}>{r === 'all' ? 'All' : r[0] + r.slice(1).toLowerCase() + 's'}</Chip>)}</div>
      </div>
      <div className="card mt-4 divide-y divide-slate-100">
        {list.isLoading && <div className="space-y-3 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {list.data?.length === 0 && <EmptyState emoji="👤" title="No users match" />}
        {list.data?.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar name={u.name} src={u.avatarUrl} />
            <div className="min-w-0 flex-1 basis-48">
              <div className="flex flex-wrap items-center gap-2 font-semibold">{u.name}<Badge tone={TONE[u.role]}>{u.role}</Badge>{!u.isActive && <Badge tone="rose">Disabled</Badge>}</div>
              <div className="truncate text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ''} · joined {fmtDate(u.createdAt)} · {u.orderCount} orders · {u.walletPoints} pts</div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={u.role} onChange={(e) => update.mutate({ id: u.id, data: { role: e.target.value } })} className="h-9 w-32 py-0 text-xs">{(['CUSTOMER', 'MERCHANT', 'RUNNER', 'ADMIN'] as Role[]).map((r) => <option key={r} value={r}>{r}</option>)}</Select>
              <Button size="sm" variant="ghost" onClick={() => { const v = prompt(`Set wallet points for ${u.name}:`, String(u.walletPoints)); if (v !== null && !Number.isNaN(Number(v))) update.mutate({ id: u.id, data: { walletPoints: Math.max(0, Math.round(Number(v))) } }); }}>Points</Button>
              <Button size="sm" variant={u.isActive ? 'outline' : 'primary'} className={u.isActive ? 'text-rose-600' : ''} onClick={() => update.mutate({ id: u.id, data: { isActive: !u.isActive } })}>{u.isActive ? 'Disable' : 'Enable'}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

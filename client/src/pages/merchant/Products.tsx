import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Minus, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { ProductThumb } from '@/components/shop/ProductCard';
import { Badge, Button, Chip, EmptyState, Field, Input, Select, Skeleton, Switch, Textarea } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useConfig } from '@/hooks/useConfig';
import type { Product } from '@/lib/types';
import { cn, money } from '@/lib/utils';

const EMOJIS = ['🥛', '🥚', '🍞', '🍎', '🍌', '🥭', '🍊', '🍇', '🍉', '🥔', '🧅', '🍅', '🥬', '🥕', '🌶️', '🥩', '🍗', '🐟', '🍚', '🌾', '🧂', '🫒', '🍯', '🍵', '☕', '🧃', '🥤', '🍪', '🍫', '🧁', '🍬', '💊', '🧴', '🧼', '🧻', '🧺', '📦'];

export default function MerchantProducts() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['merchant', 'products'], queryFn: api.merchant.products });
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [del, setDel] = useState<Product | null>(null);

  const categories = useMemo(() => Array.from(new Set((q.data ?? []).map((p) => p.category))).sort(), [q.data]);
  const list = useMemo(() => (q.data ?? []).filter((p) => (!cat || p.category === cat) && (!search || p.name.toLowerCase().includes(search.toLowerCase()))), [q.data, cat, search]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['merchant', 'products'] }); qc.invalidateQueries({ queryKey: ['merchant', 'analytics'] }); };
  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => api.merchant.updateProduct(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ['merchant', 'products'] });
      const prev = qc.getQueryData<Product[]>(['merchant', 'products']);
      qc.setQueryData<Product[]>(['merchant', 'products'], (old = []) => old.map((p) => (p.id === id ? { ...p, ...data } : p)));
      return { prev };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['merchant', 'products'], ctx.prev); toast.error((e as Error).message); },
    onSettled: refresh,
  });
  const delM = useMutation({ mutationFn: (id: string) => api.merchant.deleteProduct(id), onSuccess: () => { refresh(); toast.success('Product deleted'); } });
  const outOfStock = (q.data ?? []).filter((p) => p.stock === 0 || !p.isAvailable).length;

  return (
    <div>
      <DashHeader title="Products" subtitle={q.data ? `${q.data.length} products · ${outOfStock} unavailable` : undefined} action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Add product</Button>} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input leftIcon={<Search className="h-4 w-4" />} placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-xs" />
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <Chip active={!cat} onClick={() => setCat(null)}>All</Chip>
          {categories.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {q.isLoading && [1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28" />)}
        {q.data?.length === 0 && <div className="md:col-span-2 xl:col-span-3"><EmptyState emoji="📦" title="Add your first product" description="Customers can only order what's listed here. Add items with prices, units and stock." action={<Button onClick={() => setEditing('new')}>Add product</Button>} /></div>}
        {list.map((p) => (
          <div key={p.id} className={cn('card flex gap-3 p-3', (!p.isAvailable || p.stock === 0) && 'opacity-80')}>
            <ProductThumb product={p} className="h-20 w-20 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="flex items-center gap-1 truncate font-bold">{p.name}{p.isFeatured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}</div><div className="text-xs text-slate-500">{p.category} · per {p.unit}</div></div>
                <div className="text-right"><div className="font-extrabold tabular">{money(p.price)}</div>{p.compareAtPrice && <div className="text-[11px] text-slate-400 line-through tabular">{money(p.compareAtPrice)}</div>}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => patch.mutate({ id: p.id, data: { stock: Math.max(0, p.stock - 1) } })} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100"><Minus className="h-3.5 w-3.5" /></button>
                  <span className={cn('w-12 text-center text-sm font-bold tabular', p.stock === 0 ? 'text-rose-600' : p.stock <= 5 ? 'text-amber-600' : '')}>{p.stock}</span>
                  <button onClick={() => patch.mutate({ id: p.id, data: { stock: p.stock + 1 } })} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100"><Plus className="h-3.5 w-3.5" /></button>
                  <button onClick={() => patch.mutate({ id: p.id, data: { stock: p.stock + 10 } })} className="ml-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold">+10</button>
                </div>
                <div className="flex items-center gap-2">
                  {p.stock === 0 ? <Badge tone="rose">Out</Badge> : !p.isAvailable ? <Badge>Hidden</Badge> : null}
                  <Switch checked={p.isAvailable} onChange={(v) => patch.mutate({ id: p.id, data: { isAvailable: v } })} />
                  <button onClick={() => setEditing(p)} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDel(p)} className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New product' : 'Edit product'} size="tall">
        {editing && <ProductForm existing={editing === 'new' ? undefined : editing} categories={categories} onDone={() => { refresh(); setEditing(null); }} />}
      </Sheet>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.name}?`} description="Past orders keep their line items; the product just disappears from your storefront." danger confirmLabel="Delete" onConfirm={() => delM.mutateAsync(del!.id).then(() => setDel(null))} />
    </div>
  );
}

function ProductForm({ existing, categories, onDone }: { existing?: Product; categories: string[]; onDone: () => void }) {
  const { config } = useConfig();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    name: existing?.name ?? '', description: existing?.description ?? '', category: existing?.category ?? (categories[0] ?? 'General'), unit: existing?.unit ?? 'piece',
    price: existing?.price?.toString() ?? '', compareAtPrice: existing?.compareAtPrice?.toString() ?? '', stock: existing?.stock?.toString() ?? '20', emoji: existing?.emoji ?? '📦', imageUrl: existing?.imageUrl ?? null as string | null,
    isAvailable: existing?.isAvailable ?? true, isFeatured: existing?.isFeatured ?? false,
  });
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const data = { name: f.name, description: f.description || null, category: f.category.trim() || 'General', unit: f.unit, price: Number(f.price), compareAtPrice: f.compareAtPrice ? Number(f.compareAtPrice) : null, stock: Math.max(0, Math.round(Number(f.stock) || 0)), emoji: f.emoji || null, imageUrl: f.imageUrl, isAvailable: f.isAvailable, isFeatured: f.isFeatured };
      return existing ? api.merchant.updateProduct(existing.id, data) : api.merchant.createProduct(data);
    },
    onSuccess: () => { toast.success(existing ? 'Product updated' : 'Product added'); onDone(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const upload = async (file: File) => {
    setUploading(true);
    try { const r = await api.upload(file); set('imageUrl', r.url); } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  };
  return (
    <form className="space-y-4 pb-6" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim() || !f.price) return toast.error('Name and price are required'); save.mutate(); }}>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-4xl">
          {f.imageUrl ? <img src={f.imageUrl} alt="" className="h-full w-full object-cover" /> : f.emoji}
          <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-[10px] font-semibold text-white">{uploading ? 'Uploading…' : <><ImagePlus className="mr-1 inline h-3 w-3" />Photo</>}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <div className="flex-1">
          <div className="mb-1 text-xs font-medium text-slate-600">Emoji (shown when there's no photo)</div>
          <div className="flex flex-wrap gap-1">{EMOJIS.map((e) => <button type="button" key={e} onClick={() => set('emoji', e)} className={cn('grid h-8 w-8 place-items-center rounded-lg text-lg', f.emoji === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-slate-50')}>{e}</button>)}</div>
          {f.imageUrl && <button type="button" onClick={() => set('imageUrl', null)} className="mt-1 text-xs font-semibold text-rose-600">Remove photo</button>}
        </div>
      </div>
      <Field label="Name" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Fresh Milk" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" hint="Type a new one or pick existing"><Input list="cats" value={f.category} onChange={(e) => set('category', e.target.value)} /><datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Unit"><Select value={f.unit} onChange={(e) => set('unit', e.target.value)}>{config.units.map((u) => <option key={u} value={u}>{u}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Price (Rs)" required><Input type="number" inputMode="decimal" min={0} step="1" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
        <Field label="Was (Rs)" hint="optional"><Input type="number" inputMode="decimal" min={0} value={f.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} /></Field>
        <Field label="Stock"><Input type="number" inputMode="numeric" min={0} value={f.stock} onChange={(e) => set('stock', e.target.value)} /></Field>
      </div>
      <Field label="Description"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Origin, size, freshness…" /></Field>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-sm font-medium">Visible to customers</span><Switch checked={f.isAvailable} onChange={(v) => set('isAvailable', v)} /></div>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-sm font-medium">⭐ Feature on home page</span><Switch checked={f.isFeatured} onChange={(v) => set('isFeatured', v)} /></div>
      <Button type="submit" block size="lg" loading={save.isPending}>{existing ? 'Save changes' : 'Add product'}</Button>
    </form>
  );
}

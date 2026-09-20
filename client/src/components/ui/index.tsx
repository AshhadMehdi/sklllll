import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, Minus, Plus, Star } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

// ───────────── Button ─────────────
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent' | 'dark';
type Size = 'sm' | 'md' | 'lg' | 'xl' | 'icon';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-600/30 disabled:bg-brand-300',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 shadow-sm shadow-accent-500/30 disabled:bg-accent-200',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200 disabled:text-brand-300',
  outline: 'border border-slate-200 bg-white text-ink hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-400',
  ghost: 'text-ink hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  dark: 'bg-ink text-white hover:bg-slate-800 disabled:bg-slate-400',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2',
  xl: 'h-14 px-6 text-base rounded-2xl gap-2',
  icon: 'h-10 w-10 rounded-xl',
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size = 'md', loading, block, leftIcon, rightIcon, children, disabled, ...props }, ref) => (
  <button ref={ref} disabled={disabled || loading} className={cn('inline-flex items-center justify-center font-semibold transition-all select-none disabled:cursor-not-allowed active:scale-[0.98]', variants[variant], sizes[size], block && 'w-full', className)} {...props}>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
    {children}
    {!loading && rightIcon}
  </button>
));
Button.displayName = 'Button';

// ───────────── Inputs ─────────────
interface FieldWrapProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
  required?: boolean;
}
export function Field({ label, hint, error, className, children, required }: FieldWrapProps) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leftIcon?: ReactNode; rightSlot?: ReactNode }>(({ className, leftIcon, rightSlot, ...props }, ref) => (
  <div className="relative">
    {leftIcon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{leftIcon}</span>}
    <input ref={ref} className={cn('field', leftIcon && 'pl-10', rightSlot && 'pr-12', className)} {...props} />
    {rightSlot && <span className="absolute inset-y-0 right-2 flex items-center">{rightSlot}</span>}
  </div>
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => <textarea ref={ref} className={cn('field min-h-[88px] resize-y', className)} {...props} />);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn('field appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%2364748b%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27m6 8 4 4 4-4%27/%3E%3C/svg%3E")] bg-[length:20px] bg-[right_10px_center] bg-no-repeat pr-10', className)} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cn('inline-flex items-center gap-2 disabled:opacity-50', label && 'text-sm font-medium')}>
      <span className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-slate-300')}>
        <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
      {label}
    </button>
  );
}

// ───────────── Display ─────────────
export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn('card', onClick && 'cursor-pointer transition hover:shadow-float active:scale-[0.99]', className)}>
      {children}
    </div>
  );
}

export function Badge({ children, className, tone = 'slate' }: { children: ReactNode; className?: string; tone?: 'slate' | 'brand' | 'accent' | 'rose' | 'amber' | 'sky' | 'violet' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-50 text-brand-700',
    accent: 'bg-accent-50 text-accent-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('chip', active ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300', className)}>
      {children}
    </button>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton', className)} />;

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} />;

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-7 w-7" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({ emoji = '🧺', title, description, action, className }: { emoji?: string; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-slate-100 text-4xl">{emoji}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, className, size = 'md' }: { name: string; src?: string | null; className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' }[size];
  return src ? (
    <img src={src} alt={name} className={cn('rounded-full object-cover', sz, className)} />
  ) : (
    <div className={cn('grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white', sz, className)}>{initials(name) || '?'}</div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, size = 'md', className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm' | 'md'; className?: string }) {
  const btn = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <div className={cn('inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5', className)}>
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))} className={cn('grid place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100 active:scale-95', btn)}>
        <Minus className="h-4 w-4" />
      </button>
      <span className={cn('min-w-[2ch] text-center font-semibold tabular', size === 'sm' ? 'px-1 text-sm' : 'px-2')}>{value}</span>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={cn('grid place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:opacity-40', btn)}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function StarRating({ value, onChange, size = 'md', count }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg'; count?: number }) {
  const sz = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-8 w-8' }[size];
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" aria-label={`${i} star${i > 1 ? 's' : ''}`} disabled={!onChange} onClick={() => onChange?.(i)} className={cn(onChange && 'transition hover:scale-110 active:scale-95', !onChange && 'cursor-default')}>
          <Star className={cn(sz, i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
        </button>
      ))}
      {count != null && <span className="ml-1 text-xs text-slate-500">({count})</span>}
    </div>
  );
}

export function SectionTitle({ title, action, className, subtitle }: { title: string; subtitle?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-[17px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'default', icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'brand' | 'accent' | 'dark'; icon?: ReactNode }) {
  const tones = { default: 'card', brand: 'rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-card', accent: 'rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-card', dark: 'rounded-2xl bg-ink text-white shadow-card' };
  const muted = tone === 'default' ? 'text-slate-500' : 'text-white/75';
  return (
    <div className={cn('p-4', tones[tone])}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-xs font-medium', muted)}>{label}</span>
        {icon && <span className={cn('opacity-80', tone === 'default' && 'text-brand-600')}>{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight tabular">{value}</div>
      {sub && <div className={cn('mt-0.5 text-xs', muted)}>{sub}</div>}
    </div>
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  return label ? (
    <div className={cn('flex items-center gap-3 text-xs text-slate-400', className)}>
      <span className="h-px flex-1 bg-slate-200" />
      {label}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  ) : (
    <hr className={cn('border-slate-100', className)} />
  );
}

export function Row({ label, value, strong, className }: { label: ReactNode; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 text-sm', strong ? 'font-bold text-ink' : 'text-slate-600', className)}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

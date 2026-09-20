import { NavLink, Outlet, useLocation as useRoute } from 'react-router-dom';
import { Compass, Home, ReceiptText, ShoppingBag, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { selectCount, useCart } from '@/stores/cart';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/cart', label: 'Cart', icon: ShoppingBag },
  { to: '/orders', label: 'Orders', icon: ReceiptText },
  { to: '/profile', label: 'Profile', icon: User },
];

export function CustomerLayout() {
  const count = useCart(selectCount);
  const route = useRoute();
  const hideNav = /^\/(checkout|orders\/[^/]+|shop\/)/.test(route.pathname);
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-surface shadow-[0_0_0_1px_rgb(15_23_42/0.04)] md:my-0 md:min-h-dvh">
      <div className={cn(!hideNav && 'pb-safe-nav')}>
        <Outlet />
      </div>
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-slate-100 bg-white/95 backdrop-blur safe-bottom">
          <div className="grid grid-cols-5">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition', isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-700')}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="tab-pill" className="absolute top-1 h-1 w-8 rounded-full bg-brand-600" />}
                    <span className="relative">
                      <Icon className={cn('h-6 w-6', isActive && 'stroke-[2.4]')} />
                      {to === '/cart' && count > 0 && <span className="absolute -right-2.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{count}</span>}
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

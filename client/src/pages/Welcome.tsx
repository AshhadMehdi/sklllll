import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Bike, MapPin, ShoppingBasket, Store, Timer, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { api } from '@/lib/api';
import { homeForRole, useAuth } from '@/stores/auth';
import { APP_NAME, TAGLINE } from '@/lib/constants';

const features = [
  { icon: MapPin, title: 'Shops around you', text: 'Location-aware discovery with live delivery-zone checks and fees before you order.' },
  { icon: ShoppingBasket, title: 'One cart, many shops', text: 'Grab meat from one shop and sabzi from another — a single checkout, separate riders.' },
  { icon: Timer, title: 'Live rider tracking', text: 'Watch your rider move on the map, chat with them and get instant status updates.' },
  { icon: Wallet, title: 'Pay your way', text: 'Cash on delivery, JazzCash, Easypaisa, card or loyalty points — plus promo codes.' },
];

const demos = [
  { role: 'Customer', email: 'ali@demo.com', emoji: '🛒', desc: 'Browse, order & track' },
  { role: 'Shop owner', email: 'madina@demo.com', emoji: '🏪', desc: 'Orders, inventory & riders' },
  { role: 'Rider', email: 'rider1@demo.com', emoji: '🛵', desc: 'Deliveries & earnings' },
  { role: 'Admin', email: 'admin@qareeb.app', emoji: '🛡️', desc: 'Platform overview' },
];

export default function Welcome() {
  const { config } = useConfig();
  const nav = useNavigate();
  const setSession = useAuth((s) => s.setSession);

  const demoLogin = async (email: string) => {
    if (!config.demo) return;
    try {
      const r = await api.auth.login(email, config.demo.password);
      setSession(r.token, r.user);
      nav(homeForRole(r.user.role));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-dvh bg-white">
      <div className="relative overflow-hidden bg-gradient-to-b from-brand-700 via-brand-600 to-brand-500 text-white">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-accent-400/30 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-10 md:pt-16">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl ring-2 ring-white/30" />
              <span className="text-xl font-extrabold tracking-tight">{APP_NAME}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">Sign in</Link>
              <Link to="/register" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50">Create account</Link>
            </div>
          </div>
          <div className="mt-14 grid items-center gap-10 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent-400" /> Now delivering in {config.city.name}
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
                {TAGLINE}.
                <br />
                <span className="text-brand-100">In minutes.</span>
              </h1>
              <p className="mt-4 max-w-md text-base text-white/85 md:text-lg">Groceries, fresh meat, sabzi, dairy, bakery and pharmacy — from the shops you already trust, brought to your doorstep.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="xl" variant="dark" className="bg-ink hover:bg-slate-800" rightIcon={<ArrowRight className="h-5 w-5" />} onClick={() => nav('/home')}>
                  Start shopping
                </Button>
                <Button size="xl" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => nav('/register?role=MERCHANT')} leftIcon={<Store className="h-5 w-5" />}>
                  List your shop
                </Button>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="relative mx-auto w-full max-w-sm">
              <div className="rounded-[2rem] bg-white p-3 shadow-float">
                <img src="/images/covers/vegetables.jpg" alt="" className="h-52 w-full rounded-[1.5rem] object-cover" />
                <div className="mt-3 space-y-2 px-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-ink">Fresh Sabzi Mandi Stall</div>
                      <div className="text-xs text-slate-500">Mandian · 1.2 km · Rs 40 delivery</div>
                    </div>
                    <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">Open</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-100 text-lg">🛵</span>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-ink">Bilal is on the way</div>
                      <div className="text-[11px] text-slate-500">Arriving in ~8 min</div>
                    </div>
                    <span className="text-xs font-semibold text-brand-700">Track</span>
                  </div>
                </div>
              </div>
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute -left-6 top-10 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-ink shadow-float">
                🥩 Kakul Meat Shop <span className="text-slate-400">+</span> 🥬 Sabzi Stall
                <div className="text-[10px] font-medium text-slate-500">2 shops · 1 checkout</div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }, i) => (
            <motion.div key={title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="card p-5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-14">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: ShoppingBasket, title: 'For customers', text: 'Find what you need nearby, compare delivery fees and ETAs, and reorder favourites in a tap.', cta: 'Browse shops', to: '/home' },
            { icon: Store, title: 'For shop owners', text: 'A full back-office: live order board, inventory & stock alerts, delivery rings & fees, promos and analytics.', cta: 'Open a shop', to: '/register?role=MERCHANT' },
            { icon: Bike, title: 'For riders', text: 'Go online, get assignments from nearby shops, navigate with one tap and track your earnings.', cta: 'Become a rider', to: '/register?role=RUNNER' },
          ].map(({ icon: Icon, title, text, cta, to }) => (
            <div key={title} className="rounded-3xl bg-slate-50 p-6">
              <Icon className="h-6 w-6 text-brand-700" />
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
              <Link to={to} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                {cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {config.demo && (
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="rounded-3xl border border-dashed border-brand-300 bg-brand-50/50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold">Try the demo</h3>
                <p className="text-sm text-slate-600">One-tap sign in to explore every side of the platform. Password for all demo accounts: <code className="rounded bg-white px-1.5 py-0.5 text-xs">{config.demo.password}</code></p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {demos.map((d) => (
                <button key={d.email} onClick={() => demoLogin(d.email)} className="card flex items-center gap-3 p-4 text-left transition hover:shadow-float">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-2xl">{d.emoji}</span>
                  <span className="min-w-0">
                    <span className="block font-bold">{d.role}</span>
                    <span className="block truncate text-xs text-slate-500">{d.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {APP_NAME} · Built for local businesses in {config.city.name} 🇵🇰
      </footer>
    </div>
  );
}

import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, configureApi } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { homeForRole, useAuth } from '@/stores/auth';
import { useRealtime } from '@/hooks/useRealtime';
import { PageSpinner } from '@/components/ui';
import { RequireAuth } from '@/components/common/RequireAuth';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { MerchantShell } from '@/pages/merchant/MerchantShell';
import { RunnerShell } from '@/pages/runner/RunnerShell';
import { AdminShell } from '@/pages/admin/AdminShell';

// Public
const Welcome = lazy(() => import('@/pages/Welcome'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
// Customer
const Home = lazy(() => import('@/pages/customer/Home'));
const Explore = lazy(() => import('@/pages/customer/Explore'));
const Search = lazy(() => import('@/pages/customer/Search'));
const ShopPage = lazy(() => import('@/pages/customer/Shop'));
const Cart = lazy(() => import('@/pages/customer/Cart'));
const Checkout = lazy(() => import('@/pages/customer/Checkout'));
const Orders = lazy(() => import('@/pages/customer/Orders'));
const OrderDetail = lazy(() => import('@/pages/customer/OrderDetail'));
const Profile = lazy(() => import('@/pages/customer/Profile'));
const Addresses = lazy(() => import('@/pages/customer/Addresses'));
const Favorites = lazy(() => import('@/pages/customer/Favorites'));
const Notifications = lazy(() => import('@/pages/customer/Notifications'));
const Wallet = lazy(() => import('@/pages/customer/Wallet'));
// Merchant
const MDashboard = lazy(() => import('@/pages/merchant/Dashboard'));
const MOrders = lazy(() => import('@/pages/merchant/Orders'));
const MOrderDetail = lazy(() => import('@/pages/merchant/OrderDetail'));
const MProducts = lazy(() => import('@/pages/merchant/Products'));
const MShopSettings = lazy(() => import('@/pages/merchant/ShopSettings'));
const MRunners = lazy(() => import('@/pages/merchant/Runners'));
const MPromos = lazy(() => import('@/pages/merchant/Promos'));
const MSetup = lazy(() => import('@/pages/merchant/Setup'));
// Runner
const RHome = lazy(() => import('@/pages/runner/Home'));
const RDelivery = lazy(() => import('@/pages/runner/DeliveryDetail'));
const REarnings = lazy(() => import('@/pages/runner/Earnings'));
const RProfile = lazy(() => import('@/pages/runner/RunnerProfile'));
// Admin
const ADashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AShops = lazy(() => import('@/pages/admin/Shops'));
const AUsers = lazy(() => import('@/pages/admin/Users'));
const AOrders = lazy(() => import('@/pages/admin/Orders'));
const ASettings = lazy(() => import('@/pages/admin/Settings'));

function RootRedirect() {
  const user = useAuth((s) => s.user);
  return <Navigate to={user ? homeForRole(user.role) : '/welcome'} replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
  return null;
}

function Bootstrap() {
  const qc = useQueryClient();
  const { token, setUser, setExtras, logout } = useAuth();
  useEffect(() => {
    configureApi({
      getToken: () => useAuth.getState().token,
      onUnauthorized: () => {
        logout();
        disconnectSocket();
        qc.clear();
      },
    });
  }, [logout, qc]);
  useEffect(() => {
    if (!token) return;
    api.auth
      .me()
      .then((r) => {
        setUser(r.user);
        setExtras({ shop: r.shop ?? null, runnerProfile: r.runnerProfile ?? null });
      })
      .catch(() => {});
  }, [token, setUser, setExtras]);
  useRealtime();
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <Bootstrap />
      <ScrollToTop />
      <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Customer app (browsing is public; ordering requires sign-in) */}
          <Route element={<CustomerLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/search" element={<Search />} />
            <Route path="/shop/:id" element={<ShopPage />} />
            <Route path="/cart" element={<Cart />} />
            <Route element={<RequireAuth />}>
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/addresses" element={<Addresses />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/wallet" element={<Wallet />} />
            </Route>
          </Route>

          {/* Merchant */}
          <Route element={<RequireAuth roles={['MERCHANT']} />}>
            <Route path="/merchant/setup" element={<MSetup />} />
            <Route path="/merchant" element={<MerchantShell />}>
              <Route index element={<MDashboard />} />
              <Route path="orders" element={<MOrders />} />
              <Route path="orders/:id" element={<MOrderDetail />} />
              <Route path="products" element={<MProducts />} />
              <Route path="shop" element={<MShopSettings />} />
              <Route path="runners" element={<MRunners />} />
              <Route path="promos" element={<MPromos />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Route>

          {/* Runner */}
          <Route element={<RequireAuth roles={['RUNNER']} />}>
            <Route path="/runner" element={<RunnerShell />}>
              <Route index element={<RHome />} />
              <Route path="deliveries/:id" element={<RDelivery />} />
              <Route path="earnings" element={<REarnings />} />
              <Route path="profile" element={<RProfile />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Route>

          {/* Admin */}
          <Route element={<RequireAuth roles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<ADashboard />} />
              <Route path="shops" element={<AShops />} />
              <Route path="users" element={<AUsers />} />
              <Route path="orders" element={<AOrders />} />
              <Route path="orders/:id" element={<MOrderDetail />} />
              <Route path="settings" element={<ASettings />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  );
}

import type {
  Address, AdminStats, AppConfig, ChatMessage, DeliveryZone, FeaturedProduct, MerchantAnalytics, Notification, Order, Product, Promo, Quote, RunnerEarnings, RunnerProfile, RunnerSummary, Shop, ShopDetail, User,
} from './types';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let tokenGetter: () => string | null = () => null;
let onUnauthorized: () => void = () => {};
export const configureApi = (opts: { getToken: () => string | null; onUnauthorized: () => void }) => {
  tokenGetter = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
};

async function request<T>(method: string, path: string, body?: unknown, opts: { raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data?.error || res.statusText || 'Request failed', data?.details);
  }
  return data as T;
}

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),

  config: () => request<AppConfig>('GET', '/config'),

  auth: {
    login: (email: string, password: string) => request<{ token: string; user: User }>('POST', '/auth/login', { email, password }),
    register: (data: { name: string; email: string; password: string; phone?: string; role: string; vehicleType?: string }) => request<{ token: string; user: User }>('POST', '/auth/register', data),
    google: (credential: string, role?: string) => request<{ token: string; user: User }>('POST', '/auth/google', { credential, role }),
    me: () => request<{ user: User; shop?: { id: string; name: string; status: string } | null; runnerProfile?: RunnerProfile | null }>('GET', '/auth/me'),
    changePassword: (currentPassword: string | undefined, newPassword: string) => request<{ ok: true }>('POST', '/auth/change-password', { currentPassword, newPassword }),
  },

  users: {
    updateMe: (data: Partial<Pick<User, 'name' | 'phone' | 'avatarUrl'>>) => request<{ user: User }>('PATCH', '/users/me', data),
    addresses: () => request<Address[]>('GET', '/users/me/addresses'),
    createAddress: (data: Partial<Address>) => request<Address>('POST', '/users/me/addresses', data),
    updateAddress: (id: string, data: Partial<Address>) => request<Address>('PATCH', `/users/me/addresses/${id}`, data),
    deleteAddress: (id: string) => request<{ ok: true }>('DELETE', `/users/me/addresses/${id}`),
    favorites: () => request<Shop[]>('GET', '/users/me/favorites'),
    toggleFavorite: (shopId: string) => request<{ favorite: boolean }>('POST', `/users/me/favorites/${shopId}`),
    notifications: () => request<{ notifications: Notification[]; unread: number }>('GET', '/users/me/notifications'),
    readAll: () => request<{ ok: true }>('POST', '/users/me/notifications/read-all'),
    readOne: (id: string) => request<{ ok: true }>('POST', `/users/me/notifications/${id}/read`),
    pushSubscribe: (sub: PushSubscriptionJSON) => request<{ ok: true }>('POST', '/users/me/push/subscribe', sub),
    pushUnsubscribe: (endpoint: string) => request<{ ok: true }>('POST', '/users/me/push/unsubscribe', { endpoint }),
    wallet: () => request<{ walletPoints: number; history: { id: string; orderNumber: string; pointsEarned: number; total: number; paymentMethod: string; paymentStatus: string; createdAt: string; deliveredAt: string | null }[] }>('GET', '/users/me/wallet'),
  },

  shops: {
    list: (params: { lat?: number; lng?: number; radius?: number; category?: string; q?: string; openNow?: boolean; sort?: string; limit?: number }) => request<{ shops: Shop[]; center: { lat: number; lng: number }; radiusKm: number; total: number }>('GET', `/shops${qs(params)}`),
    categories: () => request<{ id: string; label: string; emoji: string; count: number }[]>('GET', '/shops/categories'),
    featured: (params: { lat?: number; lng?: number }) => request<FeaturedProduct[]>('GET', `/shops/featured${qs(params)}`),
    get: (id: string, params: { lat?: number; lng?: number } = {}) => request<ShopDetail>('GET', `/shops/${id}${qs(params)}`),
  },

  orders: {
    quote: (body: unknown) => request<Quote>('POST', '/orders/quote', body),
    checkout: (body: unknown) => request<{ orders: Order[]; groupId: string }>('POST', '/orders/checkout', body),
    list: (scope: 'active' | 'past' | 'all' = 'all') => request<Order[]>('GET', `/orders${qs({ scope })}`),
    get: (id: string) => request<Order>('GET', `/orders/${id}`),
    cancel: (id: string, reason?: string) => request<Order>('POST', `/orders/${id}/cancel`, { reason }),
    review: (id: string, data: { shopRating: number; runnerRating?: number | null; comment?: string }) => request<Order>('POST', `/orders/${id}/review`, data),
    messages: (id: string) => request<ChatMessage[]>('GET', `/orders/${id}/messages`),
    sendMessage: (id: string, body: string) => request<ChatMessage>('POST', `/orders/${id}/messages`, { body }),
  },

  merchant: {
    shop: () => request<Shop | null>('GET', '/merchant/shop'),
    createShop: (data: unknown) => request<Shop>('POST', '/merchant/shop', data),
    updateShop: (data: unknown) => request<Shop>('PATCH', '/merchant/shop', data),
    saveZones: (zones: Omit<DeliveryZone, 'id' | 'shopId' | 'sortOrder'>[]) => request<DeliveryZone[]>('PUT', '/merchant/zones', zones),
    products: () => request<Product[]>('GET', '/merchant/products'),
    createProduct: (data: unknown) => request<Product>('POST', '/merchant/products', data),
    updateProduct: (id: string, data: unknown) => request<Product>('PATCH', `/merchant/products/${id}`, data),
    deleteProduct: (id: string) => request<{ ok: true }>('DELETE', `/merchant/products/${id}`),
    bulkProducts: (items: { id: string; stock?: number; isAvailable?: boolean; price?: number }[]) => request<{ ok: true }>('POST', '/merchant/products/bulk', items),
    orders: (scope: 'active' | 'new' | 'past' | 'all' = 'active') => request<Order[]>('GET', `/merchant/orders${qs({ scope })}`),
    setStatus: (id: string, status: string, extra: { note?: string; reason?: string } = {}) => request<Order>('POST', `/merchant/orders/${id}/status`, { status, ...extra }),
    assign: (id: string, runnerId: string | 'auto' | null) => request<Order>('POST', `/merchant/orders/${id}/assign`, { runnerId }),
    runners: () => request<{ mine: RunnerSummary[]; available: RunnerSummary[] }>('GET', '/merchant/runners'),
    addRunner: (data: { email?: string; phone?: string; runnerId?: string }) => request<{ ok: true }>('POST', '/merchant/runners', data),
    removeRunner: (id: string) => request<{ ok: true }>('DELETE', `/merchant/runners/${id}`),
    promos: () => request<Promo[]>('GET', '/merchant/promos'),
    createPromo: (data: unknown) => request<Promo>('POST', '/merchant/promos', data),
    updatePromo: (id: string, data: unknown) => request<Promo>('PATCH', `/merchant/promos/${id}`, data),
    deletePromo: (id: string) => request<{ ok: true }>('DELETE', `/merchant/promos/${id}`),
    analytics: (days = 14) => request<MerchantAnalytics>('GET', `/merchant/analytics${qs({ days })}`),
  },

  runner: {
    profile: () => request<RunnerProfile>('GET', '/runner/profile'),
    updateProfile: (data: Partial<RunnerProfile>) => request<RunnerProfile>('PATCH', '/runner/profile', data),
    location: (lat: number, lng: number) => request<{ ok: true }>('POST', '/runner/location', { lat, lng }),
    deliveries: (scope: 'active' | 'past' | 'all' = 'active') => request<Order[]>('GET', `/runner/deliveries${qs({ scope })}`),
    delivery: (id: string) => request<Order>('GET', `/runner/deliveries/${id}`),
    setStatus: (id: string, status: 'ON_THE_WAY' | 'DELIVERED', note?: string) => request<Order>('POST', `/runner/deliveries/${id}/status`, { status, note }),
    decline: (id: string, reason?: string) => request<Order>('POST', `/runner/deliveries/${id}/decline`, { reason }),
    earnings: () => request<RunnerEarnings>('GET', '/runner/earnings'),
  },

  admin: {
    stats: () => request<AdminStats>('GET', '/admin/stats'),
    shops: (params: { status?: string; q?: string } = {}) => request<(Shop & { ownerName: string; ownerEmail: string; ownerPhone: string | null; productCount: number; orderCount: number })[]>('GET', `/admin/shops${qs(params)}`),
    setShopStatus: (id: string, status: string, note?: string) => request<Shop>('PATCH', `/admin/shops/${id}`, { status, note }),
    users: (params: { role?: string; q?: string } = {}) => request<(User & { orderCount: number })[]>('GET', `/admin/users${qs(params)}`),
    updateUser: (id: string, data: { isActive?: boolean; role?: string; walletPoints?: number }) => request<User>('PATCH', `/admin/users/${id}`, data),
    orders: (params: { scope?: string; status?: string } = {}) => request<Order[]>('GET', `/admin/orders${qs(params)}`),
    setOrderStatus: (id: string, status: string, reason?: string) => request<Order>('POST', `/admin/orders/${id}/status`, { status, reason }),
    assign: (id: string, runnerId: string | 'auto' | null) => request<Order>('POST', `/admin/orders/${id}/assign`, { runnerId }),
    settings: () => request<{ settings: Record<string, unknown>; defaults: Record<string, unknown> }>('GET', '/admin/settings'),
    updateSettings: (data: Record<string, unknown>) => request<{ settings: Record<string, unknown> }>('PATCH', '/admin/settings', data),
    promos: () => request<Promo[]>('GET', '/admin/promos'),
    createPromo: (data: unknown) => request<Promo>('POST', '/admin/promos', data),
    updatePromo: (id: string, data: { isActive: boolean }) => request<Promo>('PATCH', `/admin/promos/${id}`, data),
    broadcast: (data: { title: string; body: string; role?: string }) => request<{ ok: true; sent: number }>('POST', '/admin/broadcast', data),
  },

  upload: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>('POST', '/uploads', fd);
  },
};

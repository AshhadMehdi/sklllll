/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, schema, runMigrations } from './index.js';
import { config } from '../config.js';
import { DEFAULT_HOURS, estimateEtaMinutes, haversineKm, round2 } from '../lib/geo.js';
import { newOrderNumber } from '../lib/orders.js';
import type { ShopHours } from './schema.js';

type ProductSeed = [name: string, emoji: string, price: number, unit: string, category: string, stock?: number, featured?: boolean, compareAt?: number];

interface ShopSeed {
  key: string;
  name: string;
  category: string;
  area: string;
  addressLine: string;
  lat: number;
  lng: number;
  phone: string;
  description: string;
  owner: { name: string; email: string; phone: string };
  prepTimeMin: number;
  minOrder: number;
  tags: string[];
  hours?: ShopHours;
  zones: { name: string; radiusKm: number; fee: number; freeAbove?: number | null }[];
  products: ProductSeed[];
}

const cover = (cat: string) => `/images/covers/${cat}.jpg`;

const SHOPS: ShopSeed[] = [
  {
    key: 'madina',
    name: 'Al-Madina Karyana Store',
    category: 'grocery',
    area: 'Supply Bazar',
    addressLine: 'Shop 14, Main Supply Bazar, Karakoram Highway',
    lat: 34.19,
    lng: 73.244,
    phone: '+92 300 5551001',
    description: 'Your neighbourhood karyana since 1994 — atta, rice, daal, oil, tea and all daily essentials at fair prices.',
    owner: { name: 'Haji Abdul Rauf', email: 'madina@demo.com', phone: '+92 300 5551001' },
    prepTimeMin: 15,
    minOrder: 300,
    tags: ['atta', 'rice', 'daal', 'oil', 'tea', 'sugar'],
    zones: [
      { name: 'Supply & nearby', radiusKm: 2, fee: 50, freeAbove: 1500 },
      { name: 'Abbottabad city', radiusKm: 5, fee: 100 },
      { name: 'Outskirts', radiusKm: 9, fee: 180 },
    ],
    products: [
      ['Sunridge Chakki Atta 10kg', '🌾', 1450, 'pack', 'Flour & Rice', 40, true],
      ['Super Kernel Basmati Rice', '🍚', 380, 'kg', 'Flour & Rice', 120, true],
      ['Sella Rice (Kainat)', '🍚', 320, 'kg', 'Flour & Rice', 80],
      ['Daal Chana', '🫘', 290, 'kg', 'Pulses', 60],
      ['Daal Masoor', '🫘', 310, 'kg', 'Pulses', 55],
      ['Daal Maash', '🫘', 480, 'kg', 'Pulses', 30],
      ['White Chickpeas (Kabuli)', '🫘', 420, 'kg', 'Pulses', 45],
      ['Dalda Cooking Oil 1L', '🛢️', 560, 'bottle', 'Oil & Ghee', 70, true],
      ['Habib Banaspati Ghee 1kg', '🧈', 610, 'pack', 'Oil & Ghee', 35],
      ['Tapal Danedar Tea 430g', '🍵', 720, 'pack', 'Tea & Beverages', 50, true, 780],
      ['Lipton Yellow Label 190g', '🍵', 480, 'pack', 'Tea & Beverages', 40],
      ['Sugar', '🧂', 165, 'kg', 'Essentials', 200],
      ['Salt (National Iodized)', '🧂', 60, 'pack', 'Essentials', 90],
      ['Red Chilli Powder (National) 200g', '🌶️', 290, 'pack', 'Spices', 60],
      ['Turmeric Powder 200g', '🟡', 220, 'pack', 'Spices', 50],
      ['Shan Biryani Masala', '🍛', 140, 'pack', 'Spices', 100, true],
      ['Nestlé Milkpak 1L', '🥛', 285, 'pack', 'Dairy', 60],
      ['Olpers Milk 1L', '🥛', 290, 'pack', 'Dairy', 45],
      ['Farm Eggs', '🥚', 340, 'dozen', 'Dairy', 30, true],
      ['Lifebuoy Soap', '🧼', 95, 'piece', 'Household', 80],
      ['Surf Excel 1kg', '🧺', 590, 'pack', 'Household', 30],
      ['Vim Dishwash Bar', '🧽', 70, 'piece', 'Household', 60],
    ],
  },
  {
    key: 'sabzi',
    name: 'Fresh Sabzi Mandi Stall',
    category: 'vegetables',
    area: 'Mandian',
    addressLine: 'Stall 7, Mandian Sabzi Mandi, Mansehra Road',
    lat: 34.196,
    lng: 73.2405,
    phone: '+92 301 5551002',
    description: 'Farm-fresh vegetables straight from Haripur and Mansehra farms, restocked every morning at 6 AM.',
    owner: { name: 'Gul Zaman', email: 'sabzi@demo.com', phone: '+92 301 5551002' },
    prepTimeMin: 10,
    minOrder: 200,
    tags: ['sabzi', 'vegetables', 'tomato', 'onion', 'potato', 'fresh'],
    hours: { ...DEFAULT_HOURS, mon: { open: '06:30', close: '21:00' }, sun: { open: '07:00', close: '20:00' } },
    zones: [
      { name: 'Mandian', radiusKm: 1.5, fee: 40, freeAbove: 1000 },
      { name: 'City', radiusKm: 4.5, fee: 90 },
      { name: 'Far', radiusKm: 7, fee: 150 },
    ],
    products: [
      ['Tomatoes', '🍅', 120, 'kg', 'Vegetables', 80, true],
      ['Onions', '🧅', 90, 'kg', 'Vegetables', 150, true],
      ['Potatoes', '🥔', 70, 'kg', 'Vegetables', 200, true],
      ['Green Chillies', '🌶️', 60, '250g', 'Vegetables', 60],
      ['Ginger', '🫚', 110, '250g', 'Vegetables', 40],
      ['Garlic', '🧄', 140, '250g', 'Vegetables', 50],
      ['Fresh Coriander', '🌿', 30, 'bunch', 'Herbs', 70],
      ['Mint (Podina)', '🌿', 30, 'bunch', 'Herbs', 60],
      ['Spinach (Palak)', '🥬', 80, 'kg', 'Leafy Greens', 40],
      ['Cauliflower (Gobi)', '🥦', 120, 'kg', 'Vegetables', 35],
      ['Cabbage', '🥬', 90, 'kg', 'Vegetables', 30],
      ['Okra (Bhindi)', '🫛', 160, 'kg', 'Vegetables', 25, true],
      ['Bitter Gourd (Karela)', '🥒', 130, 'kg', 'Vegetables', 20],
      ['Cucumber', '🥒', 80, 'kg', 'Salad', 50],
      ['Carrots', '🥕', 90, 'kg', 'Vegetables', 60],
      ['Capsicum', '🫑', 180, 'kg', 'Vegetables', 30],
      ['Lemon', '🍋', 200, 'kg', 'Salad', 35],
      ['Peas (Matar)', '🫛', 220, 'kg', 'Vegetables', 25],
      ['Brinjal (Baingan)', '🍆', 100, 'kg', 'Vegetables', 30],
      ['Pumpkin (Kaddu)', '🎃', 80, 'kg', 'Vegetables', 15],
    ],
  },
  {
    key: 'kakul',
    name: 'Kakul Meat & Chicken Shop',
    category: 'meat',
    area: 'PMA Kakul Road',
    addressLine: 'Near Kakul Chowk, PMA Road',
    lat: 34.183,
    lng: 73.239,
    phone: '+92 302 5551003',
    description: 'Halal mutton, beef and farm chicken cut fresh on order. Tell us your cut — qeema, boti, chops or whole.',
    owner: { name: 'Sardar Naseer', email: 'kakul@demo.com', phone: '+92 302 5551003' },
    prepTimeMin: 20,
    minOrder: 500,
    tags: ['meat', 'chicken', 'mutton', 'beef', 'halal', 'qeema'],
    hours: { ...DEFAULT_HOURS, fri: { open: '08:00', close: '12:30' } },
    zones: [
      { name: 'Kakul & Jinnahabad', radiusKm: 2.5, fee: 60, freeAbove: 2500 },
      { name: 'City', radiusKm: 6, fee: 130 },
    ],
    products: [
      ['Farm Chicken (Whole, skinless)', '🍗', 620, 'kg', 'Chicken', 50, true],
      ['Chicken Boneless', '🍗', 950, 'kg', 'Chicken', 30, true],
      ['Chicken Qeema', '🍗', 900, 'kg', 'Chicken', 25],
      ['Chicken Leg Pieces', '🍗', 700, 'kg', 'Chicken', 40],
      ['Chicken Wings', '🍗', 550, 'kg', 'Chicken', 20],
      ['Mutton (Mixed Boti)', '🥩', 2400, 'kg', 'Mutton', 15, true],
      ['Mutton Chops', '🥩', 2600, 'kg', 'Mutton', 10],
      ['Mutton Qeema', '🥩', 2450, 'kg', 'Mutton', 12],
      ['Mutton Paya (Trotters)', '🦴', 900, 'pack', 'Mutton', 8],
      ['Beef Boneless', '🥩', 1450, 'kg', 'Beef', 25, true],
      ['Beef Qeema', '🥩', 1400, 'kg', 'Beef', 20],
      ['Beef with Bone', '🥩', 1200, 'kg', 'Beef', 30],
      ['Beef Bong (Shank)', '🦴', 1300, 'kg', 'Beef', 10],
      ['Fish Rohu (Fresh)', '🐟', 850, 'kg', 'Fish', 12],
      ['Desi Eggs', '🥚', 420, 'dozen', 'Eggs', 20],
    ],
  },
  {
    key: 'jinnahabad-mart',
    name: 'Jinnahabad Mart',
    category: 'mart',
    area: 'Jinnahabad',
    addressLine: 'Plaza 3, Main Jinnahabad Road',
    lat: 34.1765,
    lng: 73.2385,
    phone: '+92 303 5551004',
    description: 'A modern mini-mart: snacks, drinks, frozen food, baby care, toiletries and more — open till midnight.',
    owner: { name: 'Faisal Jadoon', email: 'mart@demo.com', phone: '+92 303 5551004' },
    prepTimeMin: 10,
    minOrder: 250,
    tags: ['snacks', 'drinks', 'frozen', 'baby', 'toiletries', 'late night'],
    hours: Object.fromEntries(Object.keys(DEFAULT_HOURS).map((d) => [d, { open: '09:00', close: '00:30' }])) as ShopHours,
    zones: [
      { name: 'Jinnahabad', radiusKm: 2, fee: 50, freeAbove: 2000 },
      { name: 'City', radiusKm: 5, fee: 110 },
      { name: 'Havelian side', radiusKm: 10, fee: 220 },
    ],
    products: [
      ['Lays Masala 60g', '🍟', 100, 'pack', 'Snacks', 100],
      ['Kurkure Chutney Chaska', '🍟', 60, 'pack', 'Snacks', 80],
      ['Prince Biscuits (Family)', '🍪', 120, 'pack', 'Snacks', 60, true],
      ['Sooper Biscuits (Family)', '🍪', 110, 'pack', 'Snacks', 70],
      ['Cadbury Dairy Milk 38g', '🍫', 180, 'piece', 'Snacks', 50],
      ['Coca-Cola 1.5L', '🥤', 190, 'bottle', 'Drinks', 60, true],
      ['Sprite 1.5L', '🥤', 190, 'bottle', 'Drinks', 40],
      ['Nestlé Pure Life 1.5L', '💧', 90, 'bottle', 'Drinks', 120],
      ['Red Bull 250ml', '⚡', 450, 'piece', 'Drinks', 24],
      ['Nestlé Fruita Vitals Mango 1L', '🥭', 320, 'pack', 'Drinks', 30],
      ["K&N's Chicken Nuggets 1kg", '🍗', 1650, 'pack', 'Frozen', 15, true],
      ['Menu Paratha (5 pcs)', '🫓', 380, 'pack', 'Frozen', 20],
      ['Omore Chocolate Bar', '🍦', 90, 'piece', 'Frozen', 40],
      ['Pampers Size 3 (24 pcs)', '👶', 1350, 'pack', 'Baby Care', 12],
      ['Cerelac Wheat 175g', '👶', 490, 'pack', 'Baby Care', 15],
      ['Head & Shoulders 185ml', '🧴', 620, 'bottle', 'Personal Care', 20],
      ['Colgate Max Fresh 125g', '🪥', 260, 'piece', 'Personal Care', 40],
      ['Dettol Handwash 200ml', '🧴', 340, 'bottle', 'Personal Care', 25],
      ['Always Ultra (8 pads)', '🩷', 300, 'pack', 'Personal Care', 30],
      ['Duracell AA (4 pack)', '🔋', 650, 'pack', 'Household', 10],
      ['Tissue Box (Rose Petal)', '🧻', 260, 'box', 'Household', 40],
      ['Mortein Coil', '🦟', 120, 'pack', 'Household', 30],
    ],
  },
  {
    key: 'roshan',
    name: 'Roshan Bakers & Sweets',
    category: 'bakery',
    area: 'Fawara Chowk',
    addressLine: 'Fawara Chowk, The Mall Road',
    lat: 34.157,
    lng: 73.213,
    phone: '+92 304 5551005',
    description: 'Fresh bread, cakes, rusk and traditional mithai baked daily. Famous for our pineapple cake and gulab jamun.',
    owner: { name: 'Roshan Din', email: 'roshan@demo.com', phone: '+92 304 5551005' },
    prepTimeMin: 15,
    minOrder: 300,
    tags: ['bakery', 'cake', 'bread', 'mithai', 'sweets', 'rusk'],
    zones: [
      { name: 'Mall Road area', radiusKm: 2, fee: 50, freeAbove: 1500 },
      { name: 'City', radiusKm: 5, fee: 110 },
      { name: 'Wide', radiusKm: 8, fee: 190 },
    ],
    products: [
      ['Milk Bread (Large)', '🍞', 150, 'pack', 'Bread', 40, true],
      ['Bun (6 pcs)', '🥯', 120, 'pack', 'Bread', 30],
      ['Cake Rusk 400g', '🍪', 320, 'pack', 'Bakery', 25, true],
      ['Pineapple Cake 2lb', '🍰', 1400, 'piece', 'Cakes', 6, true],
      ['Chocolate Fudge Cake 2lb', '🎂', 1600, 'piece', 'Cakes', 5],
      ['Cupcakes (6 pcs)', '🧁', 480, 'pack', 'Cakes', 12],
      ['Chicken Patties', '🥟', 90, 'piece', 'Savoury', 40],
      ['Chicken Pizza Slice', '🍕', 180, 'piece', 'Savoury', 20],
      ['Samosa (Aloo)', '🥟', 40, 'piece', 'Savoury', 60],
      ['Gulab Jamun', '🟤', 900, 'kg', 'Mithai', 10, true],
      ['Barfi (Khoya)', '⬜', 1200, 'kg', 'Mithai', 8],
      ['Jalebi', '🟠', 700, 'kg', 'Mithai', 8],
      ['Peshawari Kulcha (4 pcs)', '🫓', 200, 'pack', 'Bread', 20],
      ['Nimko Mix 500g', '🥜', 350, 'pack', 'Snacks', 20],
      ['Cream Roll (4 pcs)', '🍥', 240, 'pack', 'Bakery', 15],
    ],
  },
  {
    key: 'sehat',
    name: 'Sehat Pharmacy',
    category: 'pharmacy',
    area: 'Mansehra Road',
    addressLine: 'Opposite Ayub Teaching Hospital gate, Mansehra Road',
    lat: 34.171,
    lng: 73.226,
    phone: '+92 305 5551006',
    description: 'Licensed pharmacy open 24/7. Medicines, first aid, baby formula and health essentials delivered fast.',
    owner: { name: 'Dr. Ayesha Tanoli', email: 'sehat@demo.com', phone: '+92 305 5551006' },
    prepTimeMin: 10,
    minOrder: 150,
    tags: ['pharmacy', 'medicine', 'panadol', 'first aid', '24/7'],
    hours: Object.fromEntries(Object.keys(DEFAULT_HOURS).map((d) => [d, { open: '00:00', close: '23:59' }])) as ShopHours,
    zones: [
      { name: 'Hospital area', radiusKm: 2, fee: 60, freeAbove: 1200 },
      { name: 'City', radiusKm: 6, fee: 120 },
      { name: 'Wide', radiusKm: 12, fee: 250 },
    ],
    products: [
      ['Panadol Extra (10 tabs)', '💊', 60, 'pack', 'Pain Relief', 200, true],
      ['Brufen 400mg (10 tabs)', '💊', 90, 'pack', 'Pain Relief', 100],
      ['Disprin (10 tabs)', '💊', 45, 'pack', 'Pain Relief', 80],
      ['ORS Sachet (Nestlé)', '🧂', 30, 'piece', 'Digestive', 150, true],
      ['ENO Sachet', '🫧', 35, 'piece', 'Digestive', 100],
      ['Strepsils (Honey Lemon)', '🍬', 120, 'pack', 'Cold & Flu', 60],
      ['Cough Syrup (Corex-D) 120ml', '🧴', 210, 'bottle', 'Cold & Flu', 30],
      ['Vicks VapoRub 50ml', '🫙', 320, 'piece', 'Cold & Flu', 25],
      ['Digital Thermometer', '🌡️', 650, 'piece', 'Devices', 10, true],
      ['Blood Pressure Monitor', '🩺', 4500, 'piece', 'Devices', 3],
      ['Band-Aid (20 strips)', '🩹', 150, 'pack', 'First Aid', 40],
      ['Pyodine Solution 60ml', '🧴', 180, 'bottle', 'First Aid', 30],
      ['Surgical Mask (50 pcs)', '😷', 350, 'box', 'First Aid', 20],
      ['Hand Sanitizer 250ml', '🧴', 280, 'bottle', 'Hygiene', 30],
      ['Nido Fortified 390g', '🥛', 990, 'pack', 'Nutrition', 15],
      ['Ensure Vanilla 400g', '🥛', 2350, 'pack', 'Nutrition', 8],
      ['Centrum Multivitamin (30)', '💊', 1400, 'pack', 'Vitamins', 10],
      ['Vitamin C 500mg (Cecon)', '🍊', 260, 'pack', 'Vitamins', 30],
    ],
  },
  {
    key: 'doodh',
    name: 'Doodh Dahi House',
    category: 'dairy',
    area: 'Sir Syed Colony',
    addressLine: 'Street 2, Sir Syed Colony',
    lat: 34.162,
    lng: 73.232,
    phone: '+92 306 5551007',
    description: 'Pure fresh milk from our own farm, thick dahi, desi ghee, paneer and lassi — delivered before breakfast.',
    owner: { name: 'Muhammad Ilyas', email: 'doodh@demo.com', phone: '+92 306 5551007' },
    prepTimeMin: 8,
    minOrder: 150,
    tags: ['milk', 'dahi', 'yogurt', 'ghee', 'paneer', 'lassi'],
    hours: { ...DEFAULT_HOURS, mon: { open: '05:30', close: '21:00' }, tue: { open: '05:30', close: '21:00' }, wed: { open: '05:30', close: '21:00' }, thu: { open: '05:30', close: '21:00' }, fri: { open: '05:30', close: '21:00' }, sat: { open: '05:30', close: '21:00' }, sun: { open: '05:30', close: '21:00' } },
    zones: [
      { name: 'Colony', radiusKm: 1.5, fee: 30, freeAbove: 600 },
      { name: 'City', radiusKm: 4, fee: 80 },
    ],
    products: [
      ['Fresh Cow Milk', '🥛', 220, 'liter', 'Milk', 100, true],
      ['Fresh Buffalo Milk', '🥛', 260, 'liter', 'Milk', 60],
      ['Dahi (Yogurt)', '🥣', 260, 'kg', 'Yogurt', 40, true],
      ['Desi Ghee', '🧈', 2600, 'kg', 'Ghee & Butter', 10, true],
      ['Makhan (White Butter) 250g', '🧈', 450, 'pack', 'Ghee & Butter', 15],
      ['Paneer (Fresh) 500g', '🧀', 650, 'pack', 'Cheese', 12],
      ['Sweet Lassi 500ml', '🥤', 120, 'bottle', 'Drinks', 30],
      ['Salted Lassi 500ml', '🥤', 100, 'bottle', 'Drinks', 30],
      ['Khoya 500g', '🟤', 700, 'pack', 'Sweets', 8],
      ['Cream (Malai) 250g', '🍶', 300, 'pack', 'Milk', 15],
      ['Desi Eggs', '🥚', 400, 'dozen', 'Eggs', 20],
    ],
  },
  {
    key: 'hazara-fruit',
    name: 'Hazara Fruit Corner',
    category: 'fruits',
    area: 'Nawanshehr',
    addressLine: 'Nawanshehr Chowk, Mansehra Road',
    lat: 34.182,
    lng: 73.258,
    phone: '+92 307 5551008',
    description: 'Seasonal fruit from Swat, Hazara and Sindh — apples, kinnow, mangoes, bananas and imported favourites.',
    owner: { name: 'Sajid Awan', email: 'fruit@demo.com', phone: '+92 307 5551008' },
    prepTimeMin: 10,
    minOrder: 250,
    tags: ['fruit', 'apple', 'banana', 'mango', 'kinnow', 'fresh'],
    zones: [
      { name: 'Nawanshehr', radiusKm: 2, fee: 50, freeAbove: 1200 },
      { name: 'City', radiusKm: 6, fee: 120 },
    ],
    products: [
      ['Bananas', '🍌', 180, 'dozen', 'Fruits', 60, true],
      ['Apples (Swat Kala Kulu)', '🍎', 320, 'kg', 'Fruits', 50, true],
      ['Kinnow', '🍊', 220, 'dozen', 'Fruits', 40],
      ['Grapes (Sundarkhani)', '🍇', 450, 'kg', 'Fruits', 25],
      ['Pomegranate (Kandhari)', '🍎', 480, 'kg', 'Fruits', 20],
      ['Guava', '🍈', 200, 'kg', 'Fruits', 30],
      ['Papaya', '🍈', 260, 'kg', 'Fruits', 15],
      ['Watermelon', '🍉', 100, 'kg', 'Fruits', 30],
      ['Melon (Garma)', '🍈', 150, 'kg', 'Fruits', 20],
      ['Strawberries 500g', '🍓', 550, 'pack', 'Fruits', 10, true],
      ['Dates (Aseel) 500g', '🌴', 600, 'pack', 'Dry Fruits', 20],
      ['Peanuts (Roasted) 500g', '🥜', 450, 'pack', 'Dry Fruits', 25],
      ['Walnuts (Kernels) 250g', '🌰', 700, 'pack', 'Dry Fruits', 12],
      ['Almonds 250g', '🌰', 750, 'pack', 'Dry Fruits', 15],
      ['Fresh Orange Juice 1L', '🧃', 350, 'bottle', 'Juices', 10],
    ],
  },
  {
    key: 'shahzad',
    name: 'Shahzad Dry Fruit & Spices',
    category: 'grocery',
    area: 'Supply Bazar',
    addressLine: 'Inside Supply Bazar, Lane 3',
    lat: 34.188,
    lng: 73.247,
    phone: '+92 308 5551009',
    description: 'Premium dry fruits, whole spices, herbal teas and honey from the northern areas.',
    owner: { name: 'Shahzad Khan', email: 'shahzad@demo.com', phone: '+92 308 5551009' },
    prepTimeMin: 15,
    minOrder: 500,
    tags: ['dry fruit', 'spices', 'honey', 'saffron', 'green tea'],
    hours: { ...DEFAULT_HOURS, mon: { open: '10:00', close: '20:00' }, tue: { open: '10:00', close: '20:00' }, wed: { open: '10:00', close: '20:00' }, thu: { open: '10:00', close: '20:00' }, fri: { open: '10:00', close: '20:00' }, sat: { open: '10:00', close: '20:00' }, sun: { open: '10:00', close: '20:00', closed: true } },
    zones: [
      { name: 'City', radiusKm: 5, fee: 120, freeAbove: 3000 },
      { name: 'Wide', radiusKm: 10, fee: 220 },
    ],
    products: [
      ['Kashmiri Kahwa Green Tea 100g', '🍵', 650, 'pack', 'Tea', 20, true],
      ['Sidr Honey 500g', '🍯', 2200, 'bottle', 'Honey', 8, true],
      ['Whole Cumin (Zeera) 250g', '🌱', 400, 'pack', 'Whole Spices', 30],
      ['Black Pepper 100g', '⚫', 350, 'pack', 'Whole Spices', 25],
      ['Green Cardamom 50g', '🟢', 600, 'pack', 'Whole Spices', 20],
      ['Cinnamon Sticks 100g', '🪵', 180, 'pack', 'Whole Spices', 30],
      ['Saffron 1g (Kashmiri)', '🌸', 900, 'pack', 'Whole Spices', 10],
      ['Pistachios 250g', '🥜', 1100, 'pack', 'Dry Fruits', 10],
      ['Cashews 250g', '🥜', 950, 'pack', 'Dry Fruits', 12, true],
      ['Pine Nuts (Chilgoza) 250g', '🌰', 3200, 'pack', 'Dry Fruits', 5],
      ['Dried Apricots (Hunza) 500g', '🍑', 700, 'pack', 'Dry Fruits', 15],
      ['Raisins 500g', '🍇', 550, 'pack', 'Dry Fruits', 20],
    ],
  },
  {
    key: 'amc-chemist',
    name: 'Ayub Medical Chemist',
    category: 'pharmacy',
    area: 'Mandian',
    addressLine: 'Medical Plaza, near Ayub Medical College gate',
    lat: 34.199,
    lng: 73.247,
    phone: '+92 309 5551010',
    description: 'Trusted chemist near AMC. Prescription medicines, surgical supplies and wellness products.',
    owner: { name: 'Rizwan Qureshi', email: 'amc@demo.com', phone: '+92 309 5551010' },
    prepTimeMin: 12,
    minOrder: 200,
    tags: ['pharmacy', 'medicine', 'surgical', 'wellness'],
    zones: [
      { name: 'Mandian', radiusKm: 2.5, fee: 60, freeAbove: 1500 },
      { name: 'City', radiusKm: 6, fee: 130 },
    ],
    products: [
      ['Panadol (10 tabs)', '💊', 40, 'pack', 'Pain Relief', 150, true],
      ['Ponstan Forte (10 tabs)', '💊', 120, 'pack', 'Pain Relief', 60],
      ['Augmentin 625mg (6 tabs)', '💊', 480, 'pack', 'Antibiotics', 30],
      ['Flagyl 400mg (10 tabs)', '💊', 90, 'pack', 'Antibiotics', 40],
      ['Gaviscon Syrup 120ml', '🧴', 380, 'bottle', 'Digestive', 20],
      ['Motilium (10 tabs)', '💊', 110, 'pack', 'Digestive', 40],
      ['Glucose-D 400g', '🍬', 250, 'pack', 'Nutrition', 20],
      ['Cotton Roll 100g', '☁️', 130, 'pack', 'Surgical', 30],
      ['Crepe Bandage 4"', '🩹', 220, 'piece', 'Surgical', 20],
      ['Glucometer Strips (50)', '🩸', 1500, 'box', 'Devices', 8, true],
      ['Nebulizer Mask', '😷', 350, 'piece', 'Devices', 10],
      ['Johnson Baby Lotion 200ml', '👶', 520, 'bottle', 'Baby Care', 12],
    ],
  },
];

const RUNNERS = [
  { name: 'Bilal Ahmed', email: 'rider1@demo.com', phone: '+92 310 5552001', vehicleType: 'bike', lat: 34.184, lng: 73.238, isAvailable: true, totalDeliveries: 212, ratingAvg: 4.8, ratingCount: 96 },
  { name: 'Usman Tariq', email: 'rider2@demo.com', phone: '+92 311 5552002', vehicleType: 'bike', lat: 34.189, lng: 73.245, isAvailable: true, totalDeliveries: 138, ratingAvg: 4.6, ratingCount: 51 },
  { name: 'Hamza Khattak', email: 'rider3@demo.com', phone: '+92 312 5552003', vehicleType: 'scooter', lat: 34.17, lng: 73.228, isAvailable: false, totalDeliveries: 77, ratingAvg: 4.9, ratingCount: 30 },
  { name: 'Danish Abbasi', email: 'rider4@demo.com', phone: '+92 313 5552004', vehicleType: 'bicycle', lat: 34.16, lng: 73.216, isAvailable: true, totalDeliveries: 41, ratingAvg: 4.7, ratingCount: 18 },
];

const CUSTOMERS = [
  { name: 'Ali Khan', email: 'ali@demo.com', phone: '+92 333 5553001', walletPoints: 180 },
  { name: 'Sara Ahmed', email: 'sara@demo.com', phone: '+92 334 5553002', walletPoints: 60 },
  { name: 'Hassan Raza', email: 'hassan@demo.com', phone: '+92 335 5553003', walletPoints: 0 },
];

// Deterministic pseudo-random for reproducible demo data
let seedState = 42;
const rand = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export async function isDatabaseEmpty() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.users);
  return Number(n) === 0;
}

export async function resetDatabase() {
  const tables = ['messages', 'notifications', 'push_subscriptions', 'favorites', 'reviews', 'order_events', 'order_items', 'orders', 'promos', 'shop_runners', 'runner_profiles', 'products', 'delivery_zones', 'shops', 'addresses', 'users', 'settings'];
  for (const t of tables) await db.run(sql.raw(`DELETE FROM ${t}`));
}

export async function seed() {
  console.log('[seed] seeding demo data…');
  const passwordHash = await bcrypt.hash(config.demoPassword, 10);

  // Settings
  await db.insert(schema.settings).values([
    { key: 'cityName', value: config.defaultCity.name },
    { key: 'cityLat', value: config.defaultCity.lat },
    { key: 'cityLng', value: config.defaultCity.lng },
  ]);

  // Users
  const [admin] = await db.insert(schema.users).values({ name: 'Qareeb Admin', email: 'admin@qareeb.app', phone: '+92 300 0000000', passwordHash, role: 'ADMIN' }).returning();
  const customers = await db.insert(schema.users).values(CUSTOMERS.map((c) => ({ ...c, passwordHash, role: 'CUSTOMER' }))).returning();
  const runnerUsers = await db.insert(schema.users).values(RUNNERS.map((r) => ({ name: r.name, email: r.email, phone: r.phone, passwordHash, role: 'RUNNER' }))).returning();
  await db.insert(schema.runnerProfiles).values(
    RUNNERS.map((r, i) => ({ userId: runnerUsers[i].id, vehicleType: r.vehicleType, isAvailable: r.isAvailable, lat: r.lat, lng: r.lng, lastSeenAt: minutesAgo(r.isAvailable ? 1 : 240), totalDeliveries: r.totalDeliveries, ratingAvg: r.ratingAvg, ratingCount: r.ratingCount })),
  );

  // Addresses for customers
  const [ali, sara, hassan] = customers;
  const addressRows = await db
    .insert(schema.addresses)
    .values([
      { userId: ali.id, label: 'Home', line1: 'House 12, Street 4', area: 'Jinnahabad', city: 'Abbottabad', lat: 34.1775, lng: 73.241, instructions: 'Green gate, ring the bell twice', isDefault: true },
      { userId: ali.id, label: 'Office', line1: 'COMSATS University, University Road', area: 'Tobe Camp', city: 'Abbottabad', lat: 34.1968, lng: 73.2382, instructions: 'Ask for Ali at reception, CS block' },
      { userId: sara.id, label: 'Home', line1: 'Flat 3B, Al-Noor Apartments', area: 'Supply Bazar', city: 'Abbottabad', lat: 34.191, lng: 73.2425, isDefault: true },
      { userId: hassan.id, label: 'Home', line1: 'House 7, Kaghan Colony', area: 'Kaghan Colony', city: 'Abbottabad', lat: 34.167, lng: 73.236, isDefault: true },
    ])
    .returning();

  // Shops, zones, products
  const shopIds: Record<string, string> = {};
  const productIds: Record<string, schema.Product[]> = {};
  const shopOwners: Record<string, string> = {};
  for (const s of SHOPS) {
    const [owner] = await db.insert(schema.users).values({ name: s.owner.name, email: s.owner.email, phone: s.owner.phone, passwordHash, role: 'MERCHANT' }).returning();
    const [shop] = await db
      .insert(schema.shops)
      .values({
        ownerId: owner.id,
        name: s.name,
        slug: s.key,
        category: s.category,
        description: s.description,
        phone: s.phone,
        coverUrl: cover(s.category),
        addressLine: `${s.addressLine}, ${s.area}`,
        lat: s.lat,
        lng: s.lng,
        hours: s.hours ?? DEFAULT_HOURS,
        prepTimeMin: s.prepTimeMin,
        minOrder: s.minOrder,
        status: 'APPROVED',
        tags: s.tags,
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: new Date(Date.now() - (30 + Math.floor(rand() * 200)) * 86400_000).toISOString(),
      })
      .returning();
    shopIds[s.key] = shop.id;
    shopOwners[s.key] = owner.id;
    await db.insert(schema.deliveryZones).values(s.zones.map((z, i) => ({ ...z, shopId: shop.id, sortOrder: i, freeAbove: z.freeAbove ?? null })));
    productIds[s.key] = await db
      .insert(schema.products)
      .values(
        s.products.map(([name, emoji, price, unit, category, stock = 50, featured = false, compareAt], i) => ({
          shopId: shop.id,
          name,
          emoji,
          price,
          unit,
          category,
          stock,
          isFeatured: featured,
          compareAtPrice: compareAt ?? null,
          sortOrder: i,
          description: null,
        })),
      )
      .returning();
  }

  // Shop ↔ runner relationships
  await db.insert(schema.shopRunners).values([
    { shopId: shopIds.kakul, runnerId: runnerUsers[0].id },
    { shopId: shopIds.madina, runnerId: runnerUsers[1].id },
    { shopId: shopIds.madina, runnerId: runnerUsers[0].id },
    { shopId: shopIds['jinnahabad-mart'], runnerId: runnerUsers[2].id },
    { shopId: shopIds.roshan, runnerId: runnerUsers[3].id },
    { shopId: shopIds.sehat, runnerId: runnerUsers[0].id },
  ]);

  // Promos
  await db.insert(schema.promos).values([
    { code: 'WELCOME50', shopId: null, type: 'FIXED', value: 50, minOrder: 500, usageLimit: 1000 },
    { code: 'FREESHIP', shopId: null, type: 'FREE_DELIVERY', value: 0, minOrder: 800 },
    { code: 'MADINA10', shopId: shopIds.madina, type: 'PERCENT', value: 10, minOrder: 1000, maxDiscount: 200 },
    { code: 'SWEET15', shopId: shopIds.roshan, type: 'PERCENT', value: 15, minOrder: 600, maxDiscount: 300 },
  ]);

  // Favorites
  await db.insert(schema.favorites).values([
    { userId: ali.id, shopId: shopIds.madina },
    { userId: ali.id, shopId: shopIds.kakul },
    { userId: sara.id, shopId: shopIds.roshan },
  ]);

  // ───────────── Orders (history + live) ─────────────
  const shopByKey = (key: string) => SHOPS.find((s) => s.key === key)!;
  const addrFor = (userId: string) => addressRows.find((a) => a.userId === userId && a.isDefault)!;
  const snap = (a: schema.Address, phone: string | null) => ({ label: a.label, line1: a.line1, area: a.area, city: a.city, lat: a.lat, lng: a.lng, instructions: a.instructions, phone });

  interface DemoOrder {
    customer: schema.User;
    shopKey: string;
    status: string;
    createdMinAgo: number;
    runnerIdx?: number | null;
    items: [productIndex: number, qty: number][];
    payment?: string;
    review?: { shop: number; runner?: number; comment?: string };
    tip?: number;
    promo?: string;
  }

  const demoOrders: DemoOrder[] = [
    // Live orders for Ali
    { customer: ali, shopKey: 'kakul', status: 'ON_THE_WAY', createdMinAgo: 32, runnerIdx: 0, items: [[0, 2], [5, 1]], payment: 'COD', tip: 50 },
    { customer: ali, shopKey: 'jinnahabad-mart', status: 'PENDING', createdMinAgo: 3, items: [[5, 2], [2, 1], [10, 1]], payment: 'JAZZCASH' },
    { customer: ali, shopKey: 'sabzi', status: 'PREPARING', createdMinAgo: 14, items: [[0, 2], [1, 3], [2, 5], [6, 2]], payment: 'COD' },
    // Live orders for Sara
    { customer: sara, shopKey: 'madina', status: 'ACCEPTED', createdMinAgo: 9, runnerIdx: 1, items: [[0, 1], [9, 1], [18, 2]], payment: 'EASYPAISA', promo: 'MADINA10' },
    { customer: sara, shopKey: 'roshan', status: 'READY', createdMinAgo: 22, runnerIdx: 3, items: [[3, 1], [0, 2]], payment: 'COD' },
    { customer: hassan, shopKey: 'sehat', status: 'PENDING', createdMinAgo: 1, items: [[0, 2], [3, 5], [8, 1]], payment: 'COD' },
    // Past orders
    { customer: ali, shopKey: 'madina', status: 'DELIVERED', createdMinAgo: 60 * 26, runnerIdx: 1, items: [[1, 5], [7, 2], [11, 3]], payment: 'COD', review: { shop: 5, runner: 5, comment: 'Super quick delivery and everything was fresh. Rice quality is great!' } },
    { customer: ali, shopKey: 'sabzi', status: 'DELIVERED', createdMinAgo: 60 * 24 * 3 + 40, runnerIdx: 0, items: [[0, 2], [1, 2], [8, 1]], payment: 'COD', review: { shop: 4, runner: 5, comment: 'Tomatoes were a bit soft but everything else perfect.' } },
    { customer: ali, shopKey: 'roshan', status: 'DELIVERED', createdMinAgo: 60 * 24 * 6, runnerIdx: 3, items: [[3, 1], [9, 1]], payment: 'CARD', review: { shop: 5, runner: 4, comment: 'Pineapple cake was amazing 🎂' } },
    { customer: ali, shopKey: 'kakul', status: 'CANCELLED', createdMinAgo: 60 * 24 * 8, items: [[1, 1]], payment: 'COD' },
    { customer: sara, shopKey: 'doodh', status: 'DELIVERED', createdMinAgo: 60 * 20, runnerIdx: 2, items: [[0, 2], [2, 1]], payment: 'COD', review: { shop: 5, runner: 5 } },
    { customer: sara, shopKey: 'hazara-fruit', status: 'DELIVERED', createdMinAgo: 60 * 24 * 2, runnerIdx: 0, items: [[0, 2], [1, 2], [9, 1]], payment: 'WALLET', review: { shop: 4, runner: 4, comment: 'Good fruit, fair prices.' } },
    { customer: hassan, shopKey: 'jinnahabad-mart', status: 'DELIVERED', createdMinAgo: 60 * 24 * 1 + 120, runnerIdx: 2, items: [[10, 1], [5, 3], [15, 1]], payment: 'JAZZCASH', review: { shop: 5, runner: 5, comment: 'Late night delivery saved us!' } },
  ];
  // Extra historical volume for analytics charts
  const histShops = ['madina', 'sabzi', 'kakul', 'jinnahabad-mart', 'roshan', 'sehat', 'doodh', 'hazara-fruit'];
  for (let d = 1; d <= 14; d++) {
    const n = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      const shopKey = pick(histShops);
      const prods = productIds[shopKey];
      const nItems = 1 + Math.floor(rand() * 4);
      const items: [number, number][] = [];
      for (let j = 0; j < nItems; j++) items.push([Math.floor(rand() * prods.length), 1 + Math.floor(rand() * 3)]);
      const cancelled = rand() < 0.08;
      demoOrders.push({ customer: pick(customers), shopKey, status: cancelled ? 'CANCELLED' : 'DELIVERED', createdMinAgo: d * 1440 + Math.floor(rand() * 600), runnerIdx: cancelled ? null : Math.floor(rand() * RUNNERS.length), items, payment: pick(['COD', 'COD', 'JAZZCASH', 'EASYPAISA', 'CARD']), review: !cancelled && rand() < 0.5 ? { shop: 3 + Math.floor(rand() * 3), runner: 4 + Math.floor(rand() * 2) } : undefined });
    }
  }

  const reviewAgg: Record<string, number[]> = {};
  const runnerAgg: Record<string, number[]> = {};

  for (const o of demoOrders) {
    const s = shopByKey(o.shopKey);
    const prods = productIds[o.shopKey];
    const addr = addrFor(o.customer.id);
    const distanceKm = round2(haversineKm(s.lat, s.lng, addr.lat, addr.lng));
    const zone = [...s.zones].sort((a, b) => a.radiusKm - b.radiusKm).find((z) => distanceKm <= z.radiusKm) ?? s.zones[s.zones.length - 1];
    const lines = o.items.map(([idx, qty]) => {
      const p = prods[idx % prods.length];
      return { productId: p.id, name: p.name, unit: p.unit, unitPrice: p.price, quantity: qty, total: round2(p.price * qty), emoji: p.emoji, imageUrl: p.imageUrl };
    });
    const subtotal = round2(lines.reduce((a, l) => a + l.total, 0));
    const deliveryFee = zone.freeAbove != null && subtotal >= zone.freeAbove ? 0 : zone.fee;
    const serviceFee = 15;
    const discount = o.promo === 'MADINA10' ? Math.min(round2(subtotal * 0.1), 200) : 0;
    const tip = o.tip ?? 0;
    const total = round2(subtotal + deliveryFee + serviceFee - discount + tip);
    const created = minutesAgo(o.createdMinAgo);
    const t = (offsetMin: number) => new Date(new Date(created).getTime() + offsetMin * 60_000).toISOString();
    const timeline: Record<string, string | null> = { acceptedAt: null, readyAt: null, pickedUpAt: null, deliveredAt: null, cancelledAt: null };
    const order = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED'];
    const stage = order.indexOf(o.status);
    if (stage >= 1) timeline.acceptedAt = t(2);
    if (stage >= 3) timeline.readyAt = t(2 + s.prepTimeMin);
    if (stage >= 4) timeline.pickedUpAt = t(5 + s.prepTimeMin);
    if (stage >= 5) timeline.deliveredAt = t(8 + s.prepTimeMin + Math.round(distanceKm * 4));
    if (o.status === 'CANCELLED') timeline.cancelledAt = t(4);
    const paid = o.payment !== 'COD' || o.status === 'DELIVERED';
    const runnerId = o.runnerIdx != null ? runnerUsers[o.runnerIdx].id : null;
    const pointsEarned = o.status === 'DELIVERED' ? Math.floor(subtotal * 0.02) : 0;
    const [row] = await db
      .insert(schema.orders)
      .values({
        orderNumber: newOrderNumber(),
        groupId: newOrderNumber(),
        customerId: o.customer.id,
        shopId: shopIds[o.shopKey],
        runnerId,
        status: o.status,
        paymentMethod: o.payment ?? 'COD',
        paymentStatus: o.status === 'CANCELLED' ? (o.payment !== 'COD' ? 'REFUNDED' : 'UNPAID') : paid ? 'PAID' : 'UNPAID',
        paymentRef: o.payment && o.payment !== 'COD' ? `${o.payment}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : null,
        subtotal,
        deliveryFee,
        serviceFee,
        discount,
        tip,
        total,
        distanceKm,
        etaMinutes: estimateEtaMinutes(s.prepTimeMin, distanceKm),
        promoCode: o.promo ?? null,
        notes: o.shopKey === 'kakul' ? 'Please cut the chicken into 12 pieces, medium size.' : null,
        deliveryAddress: snap(addr, o.customer.phone),
        pointsEarned,
        ...timeline,
        cancelledBy: o.status === 'CANCELLED' ? 'CUSTOMER' : null,
        cancelReason: o.status === 'CANCELLED' ? 'Ordered by mistake' : null,
        createdAt: created,
        updatedAt: created,
      })
      .returning();
    await db.insert(schema.orderItems).values(lines.map((l) => ({ ...l, orderId: row.id })));
    const events: { status: string; at: string; note: string | null; actorRole: string }[] = [{ status: 'PENDING', at: created, note: 'Order placed', actorRole: 'CUSTOMER' }];
    if (timeline.acceptedAt) events.push({ status: 'ACCEPTED', at: timeline.acceptedAt, note: null, actorRole: 'MERCHANT' });
    if (stage >= 2) events.push({ status: 'PREPARING', at: t(3), note: null, actorRole: 'MERCHANT' });
    if (timeline.readyAt) events.push({ status: 'READY', at: timeline.readyAt, note: null, actorRole: 'MERCHANT' });
    if (timeline.pickedUpAt) events.push({ status: 'ON_THE_WAY', at: timeline.pickedUpAt, note: 'Picked up', actorRole: 'RUNNER' });
    if (timeline.deliveredAt) events.push({ status: 'DELIVERED', at: timeline.deliveredAt, note: null, actorRole: 'RUNNER' });
    if (timeline.cancelledAt) events.push({ status: 'CANCELLED', at: timeline.cancelledAt, note: 'Ordered by mistake', actorRole: 'CUSTOMER' });
    await db.insert(schema.orderEvents).values(events.map((e) => ({ orderId: row.id, status: e.status, note: e.note, actorRole: e.actorRole, actorId: null, createdAt: e.at })));
    if (o.review && o.status === 'DELIVERED') {
      await db.insert(schema.reviews).values({ orderId: row.id, shopId: shopIds[o.shopKey], runnerId, customerId: o.customer.id, shopRating: o.review.shop, runnerRating: o.review.runner ?? null, comment: o.review.comment ?? null, createdAt: timeline.deliveredAt ?? created });
      (reviewAgg[o.shopKey] ??= []).push(o.review.shop);
      if (runnerId && o.review.runner) (runnerAgg[runnerId] ??= []).push(o.review.runner);
    }
    if (o.status === 'ON_THE_WAY' && runnerId) {
      // put the live runner between shop and customer for a realistic tracking demo
      await db.update(schema.runnerProfiles).set({ lat: (s.lat + addr.lat) / 2 + 0.0015, lng: (s.lng + addr.lng) / 2 - 0.001, lastSeenAt: minutesAgo(0) }).where(sql`${schema.runnerProfiles.userId} = ${runnerId}`);
    }
  }
  // Aggregate ratings
  for (const [key, ratings] of Object.entries(reviewAgg)) {
    const avg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    await db.update(schema.shops).set({ ratingAvg: avg, ratingCount: ratings.length }).where(sql`${schema.shops.id} = ${shopIds[key]}`);
  }

  // Chat on the live order
  const [liveOrder] = await db.select().from(schema.orders).where(sql`${schema.orders.status} = 'ON_THE_WAY'`).limit(1);
  if (liveOrder?.runnerId) {
    await db.insert(schema.messages).values([
      { orderId: liveOrder.id, senderId: liveOrder.runnerId, senderRole: 'RUNNER', body: 'Salam! Picked up your order from Kakul Meat Shop, on my way 🛵', createdAt: minutesAgo(9) },
      { orderId: liveOrder.id, senderId: liveOrder.customerId, senderRole: 'CUSTOMER', body: 'Great, the gate is green — ring the bell twice please.', createdAt: minutesAgo(8) },
      { orderId: liveOrder.id, senderId: liveOrder.runnerId, senderRole: 'RUNNER', body: 'Sure, 10 minutes away 👍', createdAt: minutesAgo(7) },
    ]);
  }

  // Notifications
  await db.insert(schema.notifications).values([
    { userId: ali.id, title: 'Welcome to Qareeb 👋', body: 'Use code WELCOME50 for Rs 50 off your first order above Rs 500.', type: 'promo', data: {}, createdAt: minutesAgo(60 * 24 * 10) },
    { userId: ali.id, title: 'Rider assigned', body: 'Bilal Ahmed will deliver your order from Kakul Meat & Chicken Shop.', type: 'delivery', data: { orderId: liveOrder?.id }, createdAt: minutesAgo(12) },
    { userId: ali.id, title: 'On the way 🛵', body: 'Bilal has picked up your order and is heading to Jinnahabad.', type: 'order', data: { orderId: liveOrder?.id }, createdAt: minutesAgo(9) },
    { userId: shopOwners['jinnahabad-mart'], title: 'New order', body: 'Ali Khan placed a new order · 3 items', type: 'order', data: {}, createdAt: minutesAgo(3) },
  ]);

  console.log(`[seed] done → ${SHOPS.length} shops, ${Object.values(productIds).flat().length} products, ${demoOrders.length} orders`);
  console.log(`[seed] demo login: admin@qareeb.app · ali@demo.com · madina@demo.com · rider1@demo.com  (password: ${config.demoPassword})`);
  void admin;
}

export async function seedIfEmpty() {
  if (await isDatabaseEmpty()) await seed();
}

// CLI: `npm run db:seed` / `npm run db:reset`
const isCli = process.argv[1]?.replace(/\\/g, '/').endsWith('/db/seed.ts') || process.argv[1]?.replace(/\\/g, '/').endsWith('/db/seed.js');
if (isCli) {
  runMigrations()
    .then(async () => {
      if (process.argv.includes('--reset')) {
        console.log('[seed] resetting database…');
        await resetDatabase();
      }
      if (await isDatabaseEmpty()) await seed();
      else console.log('[seed] database already has data — use --reset to wipe and reseed');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

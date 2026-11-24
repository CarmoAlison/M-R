import {
  Baby, Banknote, Bike, Book, Briefcase, Bus, CalendarClock, CalendarDays, Car, ChartColumn, Coffee, CreditCard,
  Dumbbell, Ellipsis, Film, Fuel, Gamepad2, Gift, GraduationCap, HandCoins, HeartPulse, House, Landmark, Laptop,
  Lightbulb, PartyPopper, PawPrint, Phone, PiggyBank, Pill, Plane, Receipt, Shirt, ShoppingBag, ShoppingCart,
  Sofa, Sparkles, Stethoscope, Store, Target, TrendingDown, TrendingUp, Tv, Utensils, Wallet, Wifi, Wrench, Zap,
} from 'lucide-react'

export const ICONS = {
  house: House, 'shopping-cart': ShoppingCart, car: Car, 'heart-pulse': HeartPulse, 'gamepad-2': Gamepad2,
  'graduation-cap': GraduationCap, utensils: Utensils, tv: Tv, ellipsis: Ellipsis, briefcase: Briefcase,
  sparkles: Sparkles, 'trending-up': TrendingUp, 'trending-down': TrendingDown, wallet: Wallet,
  'credit-card': CreditCard, 'piggy-bank': PiggyBank, landmark: Landmark, plane: Plane, shirt: Shirt, gift: Gift,
  'paw-print': PawPrint, baby: Baby, dumbbell: Dumbbell, fuel: Fuel, coffee: Coffee, book: Book, wrench: Wrench,
  zap: Zap, wifi: Wifi, phone: Phone, receipt: Receipt, 'hand-coins': HandCoins, banknote: Banknote,
  stethoscope: Stethoscope, bus: Bus, bike: Bike, pill: Pill, film: Film, 'shopping-bag': ShoppingBag, store: Store,
  sofa: Sofa, laptop: Laptop, target: Target, 'calendar-clock': CalendarClock, 'calendar-days': CalendarDays,
  lightbulb: Lightbulb, 'party-popper': PartyPopper, 'chart-column': ChartColumn,
}

/** Ícones oferecidos ao criar categorias personalizadas */
export const CATEGORY_ICON_CHOICES = [
  'house', 'shopping-cart', 'car', 'heart-pulse', 'gamepad-2', 'graduation-cap', 'utensils', 'tv', 'briefcase',
  'sparkles', 'trending-up', 'piggy-bank', 'plane', 'shirt', 'gift', 'paw-print', 'baby', 'dumbbell', 'fuel',
  'coffee', 'book', 'wrench', 'zap', 'wifi', 'phone', 'receipt', 'hand-coins', 'stethoscope', 'bus', 'bike',
  'pill', 'film', 'shopping-bag', 'store', 'sofa', 'laptop', 'ellipsis',
]

export const CATEGORY_COLORS = [
  '#A48374', '#7E8F6F', '#C29A5B', '#B5675B', '#8E7A8A', '#6F8584', '#C08A6B', '#9A7B6C', '#A39B92', '#7A5B4E',
]

export default function CategoryIcon({ name, size = 20, ...rest }) {
  const Icon = ICONS[name] || Ellipsis
  return <Icon size={size} aria-hidden="true" {...rest} />
}

/** Bolha colorida com o ícone da categoria (cor com transparência para suavizar). */
export function CategoryBubble({ category, size = 42 }) {
  const color = category?.color || '#8E8580'
  return (
    <span
      className="icon-bubble"
      style={{ width: size, height: size, background: `${color}1c`, color }}
      aria-hidden="true"
    >
      <CategoryIcon name={category?.icon} size={Math.round(size * 0.47)} />
    </span>
  )
}

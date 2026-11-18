import {
  Hammer, Wrench, Laptop, Briefcase, Coins, Utensils, Car, ShoppingBasket, Receipt, ShoppingBag, User, MoreHorizontal,
  Wifi, Smartphone, Music, Home, Heart, Gift, GraduationCap, Plane, Fuel, Pill, Coffee, Baby, Dumbbell, Tv, Zap, Droplets,
  PiggyBank, ArrowLeftRight, type LucideIcon
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  hammer: Hammer, wrench: Wrench, laptop: Laptop, briefcase: Briefcase, coins: Coins, utensils: Utensils, car: Car,
  basket: ShoppingBasket, receipt: Receipt, bag: ShoppingBag, user: User, dots: MoreHorizontal, wifi: Wifi, phone: Smartphone,
  music: Music, home: Home, heart: Heart, gift: Gift, school: GraduationCap, travel: Plane, fuel: Fuel, health: Pill,
  coffee: Coffee, baby: Baby, sport: Dumbbell, tv: Tv, power: Zap, water: Droplets, piggy: PiggyBank, transfer: ArrowLeftRight
};
export const iconFor = (name?: string): LucideIcon => (name && CATEGORY_ICONS[name]) || MoreHorizontal;

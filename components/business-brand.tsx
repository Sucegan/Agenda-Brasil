import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Crown, Scissors, Sparkles, Star, Store } from 'lucide-react';
import type { BrandIcon } from '@/lib/database.types';

const iconMap: Record<BrandIcon, LucideIcon> = {
  tesoura: Scissors,
  coroa: Crown,
  barba: Sparkles,
  estrela: Star,
  calendario: CalendarDays,
  loja: Store,
};

export const brandIconLabels: Record<BrandIcon, string> = {
  tesoura: 'Tesoura',
  coroa: 'Coroa',
  barba: 'Barbearia',
  estrela: 'Estrela',
  calendario: 'Calendário',
  loja: 'Loja',
};

export function BusinessBrandIcon({ icon, size = 22, className }: {
  icon: BrandIcon;
  size?: number;
  className?: string;
}) {
  const Icon = iconMap[icon] ?? Scissors;
  return <Icon aria-hidden="true" size={size} className={className} />;
}

export function businessBrandStyle(primary: string, secondary: string): CSSProperties {
  return {
    '--brand-primary': primary,
    '--brand-secondary': secondary,
    '--brand-primary-soft': `${primary}24`,
    '--brand-secondary-soft': `${secondary}20`,
  } as CSSProperties;
}

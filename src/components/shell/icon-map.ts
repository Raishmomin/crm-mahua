import {
  BarChart3,
  Building2,
  Files,
  FileText,
  FlaskConical,
  History,
  Home,
  Inbox,
  IndianRupee,
  LayoutGrid,
  Package,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** lucide icon for the names stored in MAIN_NAV / ALL_MODULES (src/lib/labels.ts). */
export const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Inbox,
  Building2,
  FlaskConical,
  FileText,
  ShoppingBag,
  IndianRupee,
  Package,
  Files,
  BarChart3,
  Users,
  Store,
  History,
  LayoutGrid,
};

export function iconFor(name: string): LucideIcon {
  return ICON_MAP[name] ?? LayoutGrid;
}

import {
  AppWindow,
  CircleUserRound,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

export type ProfileForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailUpdates: boolean;
  securityAlerts: boolean;
};

export type SidebarItem = {
  label: string;
  href: string;
  tab: string;
  icon: LucideIcon;
};

export const sidebarItems: SidebarItem[] = [
  {
    label: 'Profile Settings',
    href: '/settings',
    tab: '',
    icon: CircleUserRound,
  },
  {
    label: 'Security',
    href: '/settings?tab=security',
    tab: 'security',
    icon: ShieldCheck,
  },
  {
    label: 'Connected Apps',
    href: '/settings?tab=apps',
    tab: 'apps',
    icon: AppWindow,
  },
  {
    label: 'Active Sessions',
    href: '/settings?tab=sessions',
    tab: 'sessions',
    icon: Smartphone,
  },
];

export const initialProfileForm: ProfileForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  emailUpdates: false,
  securityAlerts: false,
};

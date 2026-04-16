export interface BrandingConfig {
  primary_color: string;
  secondary_color: string;
}

export interface GymSettings {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  description: string | null;
  operating_hours: OperatingHours | null;
  mobile_payments_enabled: boolean;
  capacity_feature_enabled: boolean;
  max_capacity: number | null;
  branding_config: BrandingConfig | null;
}

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

export type OperatingHours = {
  [day in 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday']: DayHours;
};

export const DEFAULT_HOURS: OperatingHours = {
  monday:    { open: '06:00', close: '22:00', closed: false },
  tuesday:   { open: '06:00', close: '22:00', closed: false },
  wednesday: { open: '06:00', close: '22:00', closed: false },
  thursday:  { open: '06:00', close: '22:00', closed: false },
  friday:    { open: '06:00', close: '22:00', closed: false },
  saturday:  { open: '08:00', close: '20:00', closed: false },
  sunday:    { open: '08:00', close: '18:00', closed: false },
};

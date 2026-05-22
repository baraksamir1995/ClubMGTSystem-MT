'use client';

import {
  createContext,
  useContext,
  createElement,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ElementType,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * Tabs — controlled chip-style tab bar.
 *
 *   <Tabs value={activeTab} onValueChange={setActiveTab}>
 *     <Tabs.List>
 *       <Tabs.Trigger value="pt"     icon={Dumbbell}>Personal Training</Tabs.Trigger>
 *       <Tabs.Trigger value="physio" icon={PersonStanding}>Physiotherapy</Tabs.Trigger>
 *     </Tabs.List>
 *     <Tabs.Content value="pt">…PT body…</Tabs.Content>
 *     <Tabs.Content value="physio">…Physio body…</Tabs.Content>
 *   </Tabs>
 *
 * `<Tabs.Content>` is optional. If you'd rather switch the body
 * yourself (the existing Services page does this), drop `<Tabs.Content>`
 * and render conditionally on the same `activeTab` state.
 */

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}
const TabsContext = createContext<TabsContextValue | null>(null);
function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`${component} must be rendered inside <Tabs>`);
  return ctx;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}

export function Tabs({ value, onValueChange, className, children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

/** Horizontal pill bar holding the triggers. Wraps on small screens. */
function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex flex-wrap gap-1 bg-surface-2 border border-line rounded-xl p-1',
        className,
      )}
    >
      {children}
    </div>
  );
}
Tabs.List = TabsList;

/** Optional divider between groups of triggers — used in the existing
 *  Services bar between service-type tabs and the catalog tabs. */
function TabsDivider({ className }: { className?: string }) {
  return <div className={cn('w-px bg-line mx-1 self-stretch', className)} />;
}
Tabs.Divider = TabsDivider;

export interface TabsTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onClick'> {
  value: string;
  /** Optional leading icon — any element-like component (lucide-react icons
   *  are typed as `React.ForwardRefExoticComponent` which satisfies
   *  `ElementType` but not the stricter `ComponentType<{className?: string}>`). */
  icon?: ElementType;
}

function TabsTrigger({ value, icon: Icon, className, children, ...rest }: TabsTriggerProps) {
  const { value: active, onValueChange } = useTabsContext('Tabs.Trigger');
  const isActive = active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onValueChange(value)}
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-surface-3 text-fg'
          : 'text-fg-muted hover:text-fg',
        className,
      )}
      {...rest}
    >
      {Icon && createElement(Icon, { className: 'w-4 h-4' })}
      {children}
    </button>
  );
}
Tabs.Trigger = TabsTrigger;

function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { value: active } = useTabsContext('Tabs.Content');
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
}
Tabs.Content = TabsContent;

'use client';

import {
  useEffect,
  useId,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Modal — backdrop + scroll container + close-on-ESC + close-on-backdrop.
 * Rendered into `document.body` so a deeply-nested caller never gets
 * clipped by an ancestor's `overflow: hidden`.
 *
 *   <Modal open={isOpen} onClose={() => setOpen(false)} size="md">
 *     <Modal.Header>New specialist</Modal.Header>
 *     <Modal.Body>…form…</Modal.Body>
 *     <Modal.Footer>
 *       <Button variant="secondary" fullWidth onClick={close}>Cancel</Button>
 *       <Button variant="primary"   fullWidth onClick={save}>Save</Button>
 *     </Modal.Footer>
 *   </Modal>
 *
 * Each slot is optional. Body is scrollable; header + footer pin to
 * the top/bottom of the panel.
 */

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const;

interface ModalContextValue {
  titleId: string;
  onClose: () => void;
}
const ModalContext = createContext<ModalContextValue | null>(null);
function useModalContext(component: string): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error(`${component} must be rendered inside <Modal>`);
  return ctx;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Width preset. `md` is the default and matches most form modals. */
  size?: keyof typeof SIZE_CLASSES;
  /** Default true. Clicking the backdrop closes the modal. */
  closeOnBackdrop?: boolean;
  className?: string;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  size = 'md',
  closeOnBackdrop = true,
  className,
  children,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC to close. Single listener regardless of how many modals are
  // mounted — only fires for the one that's currently open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock background scroll while open. Restore the previous value on
  // unmount so a torn-down modal doesn't strand `overflow: hidden`.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;
  if (typeof window === 'undefined') return null; // SSR guard for the portal target.

  const handleBackdrop = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <ModalContext.Provider value={{ titleId, onClose }}>
        <div
          ref={panelRef}
          className={cn(
            'w-full bg-surface-2 border border-line rounded-2xl shadow-2xl',
            'flex flex-col max-h-[90vh] overflow-hidden',
            SIZE_CLASSES[size],
            className,
          )}
          // Don't bubble clicks on the panel up to the backdrop's
          // onMouseDown — otherwise selecting text inside the modal
          // would close it.
          onMouseDown={e => e.stopPropagation()}
        >
          {children}
        </div>
      </ModalContext.Provider>
    </div>,
    document.body,
  );
}

interface SlotProps { children: ReactNode; className?: string }

/** Sticky header. Renders a close (×) button on the right automatically. */
function ModalHeader({ children, className }: SlotProps) {
  const { titleId, onClose } = useModalContext('Modal.Header');
  return (
    <div className={cn(
      'flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0',
      className,
    )}>
      <h2 id={titleId} className="text-base font-semibold text-fg">
        {children}
      </h2>
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
Modal.Header = ModalHeader;

/** Scrollable body. Pads to match the design system; pass `className` to override. */
function ModalBody({ children, className }: SlotProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto p-5 space-y-5', className)}>
      {children}
    </div>
  );
}
Modal.Body = ModalBody;

/** Sticky footer — typically Cancel + Confirm buttons in a row. */
function ModalFooter({ children, className }: SlotProps) {
  return (
    <div className={cn(
      'flex gap-2 px-5 py-4 border-t border-line flex-shrink-0',
      className,
    )}>
      {children}
    </div>
  );
}
Modal.Footer = ModalFooter;

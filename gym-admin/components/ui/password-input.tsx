'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './input';

/**
 * PasswordInput — `<Input type="password">` with the show/hide eye
 * toggle baked in.
 *
 *   <PasswordInput value={pw} onChange={e => setPw(e.target.value)} />
 *
 * Visibility is uncontrolled by default. Pass `visible` + `onVisibleChange`
 * to control it from the outside (e.g. a "Generate" button that
 * reveals the new value).
 *
 *   const [show, setShow] = useState(false);
 *   <PasswordInput visible={show} onVisibleChange={setShow} … />
 *
 * Accepts every Input prop (`leftIcon`, `invalid`, `inputMode`, etc.) —
 * but `type` is ignored; the toggle owns it.
 */
export type PasswordInputProps = Omit<InputProps, 'type' | 'rightIcon'> & {
  /** Initial visibility for the uncontrolled case (defaults to hidden). */
  defaultVisible?: boolean;
  /** Controlled visibility. Pair with `onVisibleChange`. */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { defaultVisible = false, visible, onVisibleChange, ...rest },
    ref,
  ) {
    const [internal, setInternal] = useState(defaultVisible);
    const isControlled = visible !== undefined;
    const shown = isControlled ? visible! : internal;
    const setShown = (v: boolean) => {
      if (!isControlled) setInternal(v);
      onVisibleChange?.(v);
    };
    return (
      <Input
        ref={ref}
        type={shown ? 'text' : 'password'}
        rightIcon={
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShown(!shown)}
            className="p-1 -me-1 rounded text-fg-muted hover:text-fg transition-colors"
            aria-label={shown ? 'Hide password' : 'Show password'}
          >
            {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        {...rest}
      />
    );
  },
);

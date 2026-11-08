import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white shadow-sm shadow-primary-600/20 hover:bg-primary-700',
  secondary: 'bg-white text-neutral-800 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50',
  ghost: 'text-neutral-700 hover:bg-neutral-100',
  danger: 'bg-danger-600 text-white hover:bg-danger-700',
};

export function Button({ variant = 'primary', fullWidth = false, icon, className = '', children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-medium transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface text-foreground hover:bg-sunken',
  ghost: 'text-foreground hover:bg-sunken',
  danger: 'bg-danger text-white hover:brightness-95 dark:text-background',
};

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-[0.9375rem]',
  sm: 'min-h-9 px-3 text-sm',
};

/** Shared by Button and LinkButton so links styled as buttons look identical. */
export function buttonClass(variant: ButtonVariant, size: ButtonSize, extra = ''): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

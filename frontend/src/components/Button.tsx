import React from 'react'

type ButtonVariant = 'ghost' | 'solid' | 'outline' | 'icon'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    isLoading?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
    className = '',
    variant = 'solid',
    size = 'md',
    isLoading,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
}, ref) => {
    const baseStyles =
        'inline-flex items-center justify-center rounded-full font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] disabled:cursor-not-allowed disabled:opacity-60'

    const variants = {
        solid:
            'bg-[var(--text,#1F1E1B)] text-[var(--surface,#FFFFFF)] hover:bg-[var(--charcoal-800,#3B3935)] border border-transparent',
        ghost:
            'text-[var(--text-muted,#6B645B)] hover:bg-[var(--sand-100,#F3EBDD)] hover:text-[var(--text,#1F1E1B)]',
        outline:
            'border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)] hover:border-[var(--text,#1F1E1B)] bg-[var(--surface,#FFFFFF)]',
        icon: 'border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)] hover:text-[var(--text,#1F1E1B)] bg-[var(--surface,#FFFFFF)] hover:border-[var(--text,#1F1E1B)]',
    }

    const sizes = {
        sm: 'h-8 px-3 text-xs gap-1.5',
        md: 'h-9 px-4 text-[12px] gap-2',
        lg: 'h-10 px-5 text-sm gap-2',
        icon: 'h-9 w-9 p-0',
    }

    const classes = [
        baseStyles,
        variants[variant],
        sizes[size],
        className,
    ].join(' ')

    return (
        <button ref={ref} className={classes} disabled={disabled || isLoading} {...props}>
            {isLoading ? (
                <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {!isLoading && leftIcon}
            {children}
            {!isLoading && rightIcon}
        </button>
    )
})

Button.displayName = 'Button'

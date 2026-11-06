import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
  size?: 'sm' | 'md'
  dot?: boolean
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot, children, ...props }, ref) => {
    const variants = {
      default: 'bg-slate-100 text-slate-700',
      success: 'bg-green-100 text-green-700',
      warning: 'bg-yellow-100 text-yellow-700',
      danger: 'bg-red-100 text-red-700',
      info: 'bg-blue-100 text-blue-700',
      outline: 'bg-transparent border border-slate-300 text-slate-700',
    }

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs',
    }

    const dotColors = {
      default: 'bg-slate-400',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      danger: 'bg-red-500',
      info: 'bg-blue-500',
      outline: 'bg-slate-400',
    }

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-1.5 font-medium rounded-full',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

// Status-specific badges
export const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    UPLOADED: { variant: 'info', label: 'Subido' },
    OCR_PROCESSING: { variant: 'warning', label: 'OCR Procesando' },
    OCR_DONE: { variant: 'success', label: 'OCR Completado' },
    PII_DETECTING: { variant: 'warning', label: 'Detectando PII' },
    PII_DONE: { variant: 'success', label: 'PII Detectado' },
    IN_REVIEW: { variant: 'warning', label: 'En Revisión' },
    READY_FOR_APPROVAL: { variant: 'info', label: 'Listo para Aprobar' },
    APPROVED: { variant: 'success', label: 'Aprobado' },
    REJECTED: { variant: 'danger', label: 'Rechazado' },
    EXPORTED: { variant: 'default', label: 'Exportado' },
    FAILED: { variant: 'danger', label: 'Error' },
  }

  const cfg = config[status] || { variant: 'default', label: status }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export const ActionBadge = ({ action }: { action: string }) => {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    REMOVE: { variant: 'danger', label: 'Retirar' },
    GENERALIZE: { variant: 'warning', label: 'Generalizar' },
    PSEUDONYMIZE: { variant: 'info', label: 'Pseudonimizar' },
    KEEP: { variant: 'success', label: 'Mantener' },
    MANUAL_EDIT: { variant: 'outline', label: 'Editado' },
  }

  const cfg = config[action] || { variant: 'default', label: action }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

export const EntityTypeBadge = ({ type }: { type: string }) => {
  const colors: Record<string, BadgeProps['variant']> = {
    PERSON: 'info',
    LOCATION: 'success',
    PHONE_NUMBER: 'warning',
    EMAIL_ADDRESS: 'info',
    ES_NIF: 'danger',
    ES_NIE: 'danger',
    ES_CIF: 'danger',
    CAT_CIP: 'danger',
    IBAN_CODE: 'danger',
    DATE_TIME: 'warning',
    ICD10: 'success',
    EXPEDIENTE: 'default',
    COLEGIADO: 'info',
  }

  return <Badge variant={colors[type] || 'default'}>{type}</Badge>
}

import { useState, type ReactNode } from 'react'

/* ---------------- 画作 / 图片（外链失败时回退到元现代抽象纹理） ---------------- */
export function ArtImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="art-frame">
      <div className="art-fallback" />
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : null}
    </div>
  )
}

/* ---------------- 标签 ---------------- */
export function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: 'default' | 'acid' | 'dark' | 'outline'
}) {
  const cls =
    variant === 'acid' ? 'badge badge-acid'
    : variant === 'dark' ? 'badge badge-dark'
    : variant === 'outline' ? 'badge badge-outline'
    : 'badge'
  return <span className={cls}>{children}</span>
}

/* ---------------- 提示条 ---------------- */
export function Notice({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: 'default' | 'acid' | 'dark' | 'danger'
}) {
  const cls =
    variant === 'acid' ? 'notice notice-acid'
    : variant === 'dark' ? 'notice notice-dark'
    : variant === 'danger' ? 'notice notice-danger'
    : 'notice'
  return <div className={cls}>{children}</div>
}

/* ---------------- 隐私开关（沿用 .toggle 造型） ---------------- */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      className={`toggle${checked ? ' active' : ''}${disabled ? ' is-disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    />
  )
}

/* ---------------- 选项 chip 组 ---------------- */
export function ChipGroup({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: string[]
  value: string | string[]
  onChange: (v: string | string[]) => void
  multi?: boolean
}) {
  const isOn = (opt: string) =>
    multi ? (value as string[]).includes(opt) : value === opt

  const click = (opt: string) => {
    if (!multi) {
      onChange(opt)
      return
    }
    const current = value as string[]
    onChange(current.includes(opt) ? current.filter((v) => v !== opt) : [...current, opt])
  }

  return (
    <div className="chip-row">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          className={`chip${isOn(opt) ? ' is-selected' : ''}`}
          onClick={() => click(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

/* ---------------- 字段容器 ---------------- */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
      {hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  )
}

/* ---------------- 键值行 ---------------- */
export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="kv-row">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  )
}

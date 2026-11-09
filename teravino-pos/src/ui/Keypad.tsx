import { Delete } from 'lucide-react'

type Props = {
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  allowDecimal?: boolean
  className?: string
}

export function Keypad({ value, onChange, allowDecimal = true, className }: Props) {
  const keys: (string | 'del')[] = ['1','2','3','4','5','6','7','8','9', allowDecimal ? '.' : '00', '0', 'del']

  const press = (k: string) => {
    if (k === 'del') onChange(value.slice(0, -1))
    else if (k === '.' && value.includes('.')) return
    else onChange(value + k)
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ''}`}>
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="num-pad-btn flex items-center justify-center active:translate-y-px"
        >
          {k === 'del' ? <Delete size={22} strokeWidth={1.6} /> : k}
        </button>
      ))}
    </div>
  )
}

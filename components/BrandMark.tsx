import { CompactWordmark } from './CompactWordmark'

interface BrandMarkProps {
  href?: string
  size?: number
}

export function BrandMark({ href = '/', size = 40 }: BrandMarkProps) {
  return (
    <CompactWordmark
      href={href}
      size={size}
      theme="dark"
      priority
      textClassName={size >= 40 ? 'text-xl' : ''}
    />
  )
}

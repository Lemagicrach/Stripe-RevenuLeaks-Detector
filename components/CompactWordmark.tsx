import Image from 'next/image'
import Link from 'next/link'

type CompactWordmarkProps = {
  href?: string | null
  size?: number
  theme?: 'light' | 'dark'
  className?: string
  textClassName?: string
  priority?: boolean
}

export function CompactWordmark({
  href = '/',
  size = 36,
  theme = 'dark',
  className = '',
  textClassName = '',
  priority = false,
}: CompactWordmarkProps) {
  const resolvedHref = href === undefined ? '/' : href
  const textToneClass = theme === 'light' ? 'text-white' : 'text-gray-900'
  const textSizeClass = size >= 36 ? 'text-lg' : 'text-base'

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <Image
        src="/revpilot-logo-v2.svg"
        alt="RevPilot"
        width={size}
        height={size}
        className="rounded-md object-contain"
        priority={priority}
      />
      <span
        className={`font-semibold tracking-tight ${textToneClass} ${textSizeClass} ${textClassName}`.trim()}
      >
        RevPilot
      </span>
    </span>
  )

  if (!resolvedHref) {
    return content
  }

  return (
    <Link href={resolvedHref} className="inline-flex items-center">
      {content}
    </Link>
  )
}

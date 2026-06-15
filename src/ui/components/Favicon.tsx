import { useState } from 'react'
import { Icon } from './Icon'

/** Favicon image with a graceful globe fallback on load error or when absent. */
export function Favicon({ src, size = 15 }: { src?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span className="shrink-0 text-sky-300/80">
        <Icon name="globe" size={size} />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-sm"
      style={{ width: size, height: size }}
    />
  )
}

import { type SVGProps } from 'react'

export type IconName =
  | 'chevron'
  | 'folder'
  | 'folderOpen'
  | 'globe'
  | 'search'
  | 'settings'
  | 'expand'
  | 'collapse'
  | 'close'
  | 'refresh'
  | 'sparkle'
  | 'tag'
  | 'plus'
  | 'trash'
  | 'edit'
  | 'undo'
  | 'grid'
  | 'list'
  | 'merge'
  | 'upload'
  | 'check'

// Stroke-based 24x24 paths, rendered at any size via the `size` prop.
const PATHS: Record<IconName, string> = {
  chevron: 'M9 6l6 6-6 6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  folderOpen: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2H5l-2 9zm0 0l2 11h14',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12l-1.5 2.6 2 3.4 3-.4 2.5 1.4.5 3h3l.5-3 2.5-1.4 3 .4 2-3.4L20 12l1.5-2.6-2-3.4-3 .4L14 5l-.5-3h-3L10 5 7.5 6.4l-3-.4-2 3.4z',
  expand: 'M7 8l5 5 5-5M7 14l5 5 5-5',
  collapse: 'M7 16l5-5 5 5M7 10l5-5 5 5',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  tag: 'M3 12l8-8h7a2 2 0 0 1 2 2v7l-8 8a2 2 0 0 1-2.8 0L3 14.8a2 2 0 0 1 0-2.8zM16 8h.01',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  edit: 'M4 20h4L18 10l-4-4L4 16zM14 6l4 4',
  undo: 'M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  merge: 'M6 3v6a6 6 0 0 0 6 6h6M18 12l3 3-3 3',
  upload: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 3v12M8 7l4-4 4 4',
  check: 'M5 12l5 5L20 7',
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

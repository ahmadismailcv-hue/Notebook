// Small stroke icons in the Notion idiom: 1.6px strokes, currentColor, 20px box.
const paths: Record<string, string> = {
  menu: 'M4 6h12M4 10h12M4 14h12',
  chevronRight: 'M8 5l5 5-5 5',
  chevronsLeft: 'M11 5l-5 5 5 5M16 5l-5 5 5 5',
  plus: 'M10 4v12M4 10h12',
  more: '',
  home: 'M3.5 9.5 10 4l6.5 5.5V16a1 1 0 0 1-1 1h-3v-4.5h-5V17h-3a1 1 0 0 1-1-1z',
  trash: 'M4.5 6h11M8 6V4.5h4V6M6 6l.7 10h6.6L14 6',
  edit: 'M4 16h3l8.5-8.5-3-3L4 13z',
  smile: '',
  image: 'M3.5 4.5h13v11h-13zM3.5 13l4-4 3 3 2-2 4 4',
  logout: 'M8 4H4.5v12H8M12 6.5 15.5 10 12 13.5M15.5 10H8',
  palette: '',
  grip: '',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5 17 17',
  text: 'M5 5h10M10 5v11',
  check: 'M4.5 10.5 8 14l7.5-8',
  undo: 'M7 7h6a3.5 3.5 0 0 1 0 7H8M7 7l2.5-2.5M7 7l2.5 2.5',
  redo: 'M13 7H7a3.5 3.5 0 0 0 0 7h5M13 7l-2.5-2.5M13 7l-2.5 2.5',
  pen: 'M12.5 4.5l3 3L8 15l-3.5.5L5 12zM11 6l3 3',
  keyboardHide: 'M3.5 4.5h13v8h-13zM6 7h1M9.5 7h1M13 7h1M6.5 10h7M8 15.5l2 2 2-2',
}

export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  if (name === 'more')
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        <g fill="currentColor">
          <circle cx="4.5" cy="10" r="1.4" />
          <circle cx="10" cy="10" r="1.4" />
          <circle cx="15.5" cy="10" r="1.4" />
        </g>
      </svg>
    )
  if (name === 'grip')
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        <g fill="currentColor">
          <circle cx="7.5" cy="5" r="1.3" />
          <circle cx="12.5" cy="5" r="1.3" />
          <circle cx="7.5" cy="10" r="1.3" />
          <circle cx="12.5" cy="10" r="1.3" />
          <circle cx="7.5" cy="15" r="1.3" />
          <circle cx="12.5" cy="15" r="1.3" />
        </g>
      </svg>
    )
  if (name === 'smile')
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="10" cy="10" r="6.5" />
        <path d="M7.3 11.8c.7.9 1.6 1.4 2.7 1.4s2-.5 2.7-1.4" />
        <circle cx="7.8" cy="8.3" r=".6" fill="currentColor" />
        <circle cx="12.2" cy="8.3" r=".6" fill="currentColor" />
      </svg>
    )
  if (name === 'palette')
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10 3.5a6.5 6.5 0 1 0 0 13c1 0 1.5-.6 1.5-1.3 0-1-1-1.2-1-2.2 0-.8.7-1.3 1.5-1.3h1.8a2.7 2.7 0 0 0 2.7-2.7c0-3.1-2.9-5.5-6.5-5.5z" />
        <circle cx="6.8" cy="9.5" r=".8" fill="currentColor" />
        <circle cx="9" cy="6.6" r=".8" fill="currentColor" />
        <circle cx="12.4" cy="7" r=".8" fill="currentColor" />
      </svg>
    )
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

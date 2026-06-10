// Reusable robot avatar for the Object-Oriented Programming section. The OOP
// topics (classes/objects, inheritance, polymorphism, composition) all draw their
// robots with this one icon so the section reads as a single designed unit.
//
// It is a small inline SVG: an antenna, a head with two eyes, and a body, tinted
// by `color`. Pass `dim` for a ghosted blueprint-style robot, and `title` for the
// accessible label.
const ROBOT_PALETTE = ['#2c6e7f', '#4f6d9c', '#b07a2e', '#8a5a83']
const INK = '#1a1a1a'

export default function RobotAvatar({ color = ROBOT_PALETTE[0], size = 44, dim = false, title }) {
  const stroke = INK
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title || 'robot'}
      style={{ display: 'block', opacity: dim ? 0.4 : 1 }}
    >
      {/* antenna */}
      <line x1="24" y1="6" x2="24" y2="12" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="5" r="2.5" fill={color} stroke={stroke} strokeWidth="1.4" />
      {/* head */}
      <rect x="9" y="12" width="30" height="20" rx="5" fill={color} stroke={stroke} strokeWidth="2" />
      {/* eyes */}
      <circle cx="18" cy="22" r="3" fill="#f7f6f2" stroke={stroke} strokeWidth="1.1" />
      <circle cx="30" cy="22" r="3" fill="#f7f6f2" stroke={stroke} strokeWidth="1.1" />
      <circle cx="18" cy="22" r="1.2" fill={stroke} />
      <circle cx="30" cy="22" r="1.2" fill={stroke} />
      {/* arms */}
      <line x1="9" y1="36" x2="5" y2="40" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <line x1="39" y1="36" x2="43" y2="40" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      {/* body */}
      <rect x="14" y="34" width="20" height="10" rx="2.5" fill={color} stroke={stroke} strokeWidth="2" opacity="0.92" />
    </svg>
  )
}

export { ROBOT_PALETTE }

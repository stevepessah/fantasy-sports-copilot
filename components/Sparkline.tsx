'use client'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

/**
 * Tiny inline SVG sparkline chart.
 * Zero dependencies — renders a polyline from the given data points.
 */
export default function Sparkline({
  data,
  width = 60,
  height = 20,
  color = '#818cf8', // indigo-400
  className = '',
}: SparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const padY = 2
  const usableH = height - padY * 2

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = padY + usableH - ((v - min) / range) * usableH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  // Determine trend for dot color
  const lastVal = data[data.length - 1]
  const firstVal = data[0]
  const dotColor = lastVal >= firstVal ? '#4ade80' : '#f87171' // green-400 / red-400

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Dot on the last point */}
      <circle
        cx={(width).toFixed(1)}
        cy={(padY + usableH - ((lastVal - min) / range) * usableH).toFixed(1)}
        r="2"
        fill={dotColor}
      />
    </svg>
  )
}

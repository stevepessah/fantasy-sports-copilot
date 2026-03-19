import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  SkeletonLine,
  SkeletonBlock,
  PlayerStatsSkeleton,
  RosterListSkeleton,
  CardSkeleton,
} from '@/components/Skeleton'

describe('Skeleton components', () => {
  it('SkeletonLine renders with animate-pulse', () => {
    const { container } = render(<SkeletonLine className="h-4 w-24" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
    expect(el.className).toContain('h-4')
  })

  it('SkeletonBlock renders with animate-pulse', () => {
    const { container } = render(<SkeletonBlock className="w-6 h-6" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
  })

  it('PlayerStatsSkeleton renders without crashing', () => {
    const { container } = render(<PlayerStatsSkeleton />)
    expect(container.firstChild).toBeTruthy()
  })

  it('RosterListSkeleton renders multiple rows', () => {
    const { container } = render(<RosterListSkeleton />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(5)
  })

  it('CardSkeleton renders card structure', () => {
    const { container } = render(<CardSkeleton />)
    expect(container.querySelector('.rounded-xl')).toBeTruthy()
  })
})

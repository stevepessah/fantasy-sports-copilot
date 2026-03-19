import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/Toast'

function TestHarness() {
  const { addToast } = useToast()
  return (
    <div>
      <button onClick={() => addToast({ message: 'Success!', type: 'success' })}>
        Show Success
      </button>
      <button onClick={() => addToast({ message: 'Oops', type: 'error' })}>
        Show Error
      </button>
      <button
        onClick={() =>
          addToast({
            message: 'Undoable',
            type: 'info',
            undoAction: () => {},
            duration: 10000,
          })
        }
      >
        Show Undo
      </button>
    </div>
  )
}

describe('ToastProvider', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <span>Hello</span>
      </ToastProvider>,
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows a toast when addToast is called', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Show Success'))
    expect(screen.getByText('Success!')).toBeInTheDocument()
  })

  it('shows multiple toasts', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Show Success'))
    fireEvent.click(screen.getByText('Show Error'))
    expect(screen.getByText('Success!')).toBeInTheDocument()
    expect(screen.getByText('Oops')).toBeInTheDocument()
  })

  it('renders Undo button when undoAction is provided', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Show Undo'))
    expect(screen.getByText('Undo')).toBeInTheDocument()
  })

  it('dismisses a toast after duration', async () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('Show Success'))
    expect(screen.getByText('Success!')).toBeInTheDocument()

    // Default duration is 5000ms, then 300ms exit animation
    await act(async () => { vi.advanceTimersByTime(5500) })

    expect(screen.queryByText('Success!')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

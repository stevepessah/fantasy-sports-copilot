/** Lightweight haptic feedback utility — no-ops on devices without vibration support. */
export function hapticTap() {
  try {
    navigator?.vibrate?.(10)
  } catch {
    // silent — not all environments support vibration
  }
}

export function hapticSuccess() {
  try {
    navigator?.vibrate?.([10, 30, 10])
  } catch {
    // silent
  }
}

export function hapticError() {
  try {
    navigator?.vibrate?.([30, 20, 30, 20, 30])
  } catch {
    // silent
  }
}

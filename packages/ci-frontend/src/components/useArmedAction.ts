import { useCallback, useEffect, useState } from 'react'

// How long an armed control waits for its confirming click before standing down.
// Long enough to read the changed label, short enough that an arm you walked away
// from cannot be completed by an unrelated click minutes later.
export const ARM_TIMEOUT_MS = 5_000

// Two-step confirmation for a destructive-ish button: the first click arms it, the
// second fires. It replaces window.confirm(), which the browser answers as much as
// the viewer does — Chrome's "don't allow more dialogs" makes confirm() return
// false with nothing shown, and the board could not tell that apart from a merge
// the backend refused. Nothing between the click and the action can decline here.
//
// Lives in components/ rather than hooks/ because the architecture spec forbids a
// component importing the hooks layer; this is button-local UI state, not the
// board's data plumbing.
export function useArmedAction(fire: () => void): {
  armed: boolean
  onClick: () => void
  onBlur: () => void
} {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [armed])

  const onClick = useCallback(() => {
    if (!armed) {
      setArmed(true)
      return
    }
    setArmed(false)
    fire()
  }, [armed, fire])

  const onBlur = useCallback(() => setArmed(false), [])

  return { armed, onClick, onBlur }
}

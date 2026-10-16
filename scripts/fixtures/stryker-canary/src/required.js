export function isUnfilledAtdlValue(value) {
  return (
    value === null ||
    value === undefined ||
    // Keep the independently checked null/undefined branch separate from empty containers.
    isEmptyOptionalValue(value)
  )
}

export function requiredErrors(value) {
  return isUnfilledAtdlValue(value) ? ['This field is required.'] : []
}

function isEmptyOptionalValue(value) {
  return value === '' || (Array.isArray(value) && value.length === 0)
}

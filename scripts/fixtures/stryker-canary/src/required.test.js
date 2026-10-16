import { describe, expect, it } from 'vitest'
import { requiredErrors } from './required.js'

describe('required contract', () => {
  it('reports the literal required error for null', () => {
    expect(requiredErrors(null)).toEqual(['This field is required.'])
  })
})

it('accepts a filled value', () => {
  expect(requiredErrors(42)).toEqual([])
})

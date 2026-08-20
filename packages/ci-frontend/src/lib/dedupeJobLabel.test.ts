import { describe, it, expect } from 'vitest'
import { dedupeJobLabel } from './dedupeJobLabel'

describe('dedupeJobLabel', () => {
  it('collapses consecutive identical segments', () => {
    expect(dedupeJobLabel('Deploy (centerprise-dev) / Deploy (centerprise-dev)')).toBe('Deploy (centerprise-dev)')
  })
  it('keeps genuinely different caller / called names', () => {
    expect(dedupeJobLabel('build / deploy')).toBe('build / deploy')
  })
  it('leaves a single segment untouched', () => {
    expect(dedupeJobLabel('Publish Docker image')).toBe('Publish Docker image')
  })
  it('collapses three repeats to one', () => {
    expect(dedupeJobLabel('x / x / x')).toBe('x')
  })
})

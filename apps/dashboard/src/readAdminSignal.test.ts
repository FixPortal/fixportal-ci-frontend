import { describe, it, expect, beforeEach } from 'vitest'
import { readAdminSignal } from './readAdminSignal'

function setSearch(search: string) {
  window.history.pushState({}, '', `/${search}`)
}

describe('readAdminSignal', () => {
  beforeEach(() => {
    localStorage.clear()
    setSearch('')
  })

  it('defaults to guest when there is no query param and nothing stored', () => {
    expect(readAdminSignal()).toBe(false)
  })

  it('grants admin and persists to localStorage when ?admin=true is present', () => {
    setSearch('?admin=true')
    expect(readAdminSignal()).toBe(true)
    expect(localStorage.getItem('ci:admin')).toBe('true')
  })

  it('reads back the persisted value on a later load with no query param', () => {
    setSearch('?admin=true')
    readAdminSignal()

    setSearch('')
    expect(readAdminSignal()).toBe(true)
  })

  it('persists an explicit ?admin=false and reads it back as guest', () => {
    setSearch('?admin=false')
    expect(readAdminSignal()).toBe(false)
    expect(localStorage.getItem('ci:admin')).toBe('false')

    setSearch('')
    expect(readAdminSignal()).toBe(false)
  })
})

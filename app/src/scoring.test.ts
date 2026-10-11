import { describe, expect, it } from 'vitest'
import { qualifiesForCoding } from './scoring'

describe('technical qualification', () => {
  it('opens coding at exactly 34 out of 45', () => {
    expect(qualifiesForCoding(33)).toBe(false)
    expect(qualifiesForCoding(34)).toBe(true)
    expect(qualifiesForCoding(45)).toBe(true)
  })
})

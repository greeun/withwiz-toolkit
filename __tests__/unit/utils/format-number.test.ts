import { formatNumber, formatChartNumber } from '@withwiz/utils/format-number'

describe('formatNumber', () => {
  it('returns "-" for null', () => {
    expect(formatNumber(null)).toBe('-')
  })

  it('returns "-" for undefined', () => {
    expect(formatNumber(undefined)).toBe('-')
  })

  it('returns "NaN" for NaN', () => {
    expect(formatNumber(NaN)).toBe('NaN')
  })

  it('returns "Infinity" for positive infinity', () => {
    expect(formatNumber(Infinity)).toBe('Infinity')
  })

  it('returns "-Infinity" for negative infinity', () => {
    expect(formatNumber(-Infinity)).toBe('-Infinity')
  })

  it('returns number as string for values under 1000', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(42)).toBe('42')
    expect(formatNumber(999)).toBe('999')
  })

  it('formats numbers between 1000 and 10M with toLocaleString', () => {
    const result = formatNumber(1234)
    expect(result).toContain('1')
    expect(result).toContain('234')
  })

  it('formats numbers between 1M and 10M with toLocaleString', () => {
    const result = formatNumber(5000000)
    expect(result).toContain('5')
    expect(result).toContain('000')
    expect(result).toContain('000')
  })

  it('formats numbers >= 10M with M suffix', () => {
    expect(formatNumber(10000000)).toBe('10.0M')
    expect(formatNumber(15500000)).toBe('15.5M')
    expect(formatNumber(100000000)).toBe('100.0M')
  })

  it('handles negative numbers under 1000', () => {
    expect(formatNumber(-500)).toBe('-500')
  })

  it('handles negative numbers >= 10M with M suffix', () => {
    expect(formatNumber(-25000000)).toBe('-25.0M')
  })

  it('handles string input by parsing to number', () => {
    expect(formatNumber('42')).toBe('42')
    expect(formatNumber('15000000')).toBe('15.0M')
  })

  it('returns "NaN" for non-numeric string', () => {
    expect(formatNumber('abc')).toBe('NaN')
  })
})

describe('formatChartNumber', () => {
  it('delegates to formatNumber for null', () => {
    expect(formatChartNumber(null)).toBe('-')
  })

  it('delegates to formatNumber for undefined', () => {
    expect(formatChartNumber(undefined)).toBe('-')
  })

  it('delegates to formatNumber for a normal number', () => {
    expect(formatChartNumber(500)).toBe('500')
  })

  it('delegates to formatNumber for large number', () => {
    expect(formatChartNumber(20000000)).toBe('20.0M')
  })
})

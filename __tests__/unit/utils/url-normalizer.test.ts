import {
  hasValidScheme,
  extractScheme,
  normalizeUrl,
  validateUrl,
  isWebUrl,
  isAppScheme,
  getUrlType,
} from '@withwiz/utils/url-normalizer'

describe('hasValidScheme', () => {
  it('returns true for http URL', () => {
    expect(hasValidScheme('http://example.com')).toBe(true)
  })

  it('returns true for https URL', () => {
    expect(hasValidScheme('https://example.com')).toBe(true)
  })

  it('returns true for supported app schemes', () => {
    expect(hasValidScheme('kakaotalk://open')).toBe(true)
    expect(hasValidScheme('telegram://send')).toBe(true)
  })

  it('returns true for custom app scheme matching pattern', () => {
    expect(hasValidScheme('myapp://resource')).toBe(true)
  })

  it('returns false for javascript: scheme', () => {
    expect(hasValidScheme('javascript:alert(1)')).toBe(false)
  })

  it('returns false for data: scheme', () => {
    expect(hasValidScheme('data:text/html,<h1>hi</h1>')).toBe(false)
  })

  it('returns false for file: scheme', () => {
    expect(hasValidScheme('file:///etc/passwd')).toBe(false)
  })

  it('returns false for invalid URL', () => {
    expect(hasValidScheme('not a url')).toBe(false)
  })
})

describe('extractScheme', () => {
  it('extracts http from http URL', () => {
    expect(extractScheme('http://example.com')).toBe('http')
  })

  it('extracts https from https URL', () => {
    expect(extractScheme('https://example.com/path')).toBe('https')
  })

  it('extracts custom scheme', () => {
    expect(extractScheme('myapp://resource')).toBe('myapp')
  })

  it('extracts mailto scheme', () => {
    expect(extractScheme('mailto:test@example.com')).toBe('mailto')
  })

  it('returns null for URL without scheme', () => {
    expect(extractScheme('example.com')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractScheme('')).toBeNull()
  })
})

describe('normalizeUrl', () => {
  it('adds https:// when no scheme is present', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
  })

  it('adds https: to //-prefixed URLs', () => {
    expect(normalizeUrl('//example.com/path')).toBe('https://example.com/path')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeUrl('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeUrl('   ')).toBe('')
  })

  it('returns empty string for dangerous scheme', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('')
    expect(normalizeUrl('data:text/html,evil')).toBe('')
  })

  it('preserves valid https URL as-is', () => {
    expect(normalizeUrl('https://example.com/path')).toBe('https://example.com/path')
  })

  it('preserves valid http URL as-is', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
  })

  it('preserves app scheme URL as-is', () => {
    expect(normalizeUrl('kakaotalk://open')).toBe('kakaotalk://open')
  })

  it('trims whitespace from input', () => {
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com')
  })
})

describe('validateUrl', () => {
  it('validates a standard web URL as valid', () => {
    const result = validateUrl('https://example.com')
    expect(result.isValid).toBe(true)
    expect(result.messageKey).toBe('validUrl')
    expect(result.normalizedUrl).toBe('https://example.com')
  })

  it('validates mailto: URL with valid email', () => {
    const result = validateUrl('mailto:user@example.com')
    expect(result.isValid).toBe(true)
    expect(result.messageKey).toBe('validUrl')
  })

  it('validates tel: URL with phone number', () => {
    const result = validateUrl('tel:+821012345678')
    expect(result.isValid).toBe(true)
    expect(result.messageKey).toBe('validUrl')
  })

  it('rejects empty input', () => {
    const result = validateUrl('')
    expect(result.isValid).toBe(false)
    expect(result.messageKey).toBe('urlRequired')
  })

  it('rejects whitespace-only input', () => {
    const result = validateUrl('   ')
    expect(result.isValid).toBe(false)
    expect(result.messageKey).toBe('urlRequired')
  })

  it('rejects domain without dot for http/https', () => {
    const result = validateUrl('https://nodot')
    expect(result.isValid).toBe(false)
    expect(result.messageKey).toBe('invalidDomainFormat')
  })

  it('allows localhost for http/https', () => {
    const result = validateUrl('http://localhost:3000')
    expect(result.isValid).toBe(true)
  })

  it('rejects URL longer than 2048 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2100)
    const result = validateUrl(longUrl)
    expect(result.isValid).toBe(false)
    expect(result.messageKey).toBe('urlTooLong')
  })

  it('normalizes URL without scheme by adding https://', () => {
    const result = validateUrl('example.com')
    expect(result.isValid).toBe(true)
    expect(result.normalizedUrl).toContain('https://example.com')
  })

  it('skips normalization when skipNormalization is true', () => {
    const result = validateUrl('example.com', { skipNormalization: true })
    expect(result.isValid).toBe(false)
    expect(result.messageKey).toBe('invalidUrlFormat')
  })

  it('rejects invalid mailto format', () => {
    const result = validateUrl('mailto:notanemail')
    expect(result.isValid).toBe(false)
    expect(result.messageKey).toBe('invalidEmail')
  })

  it('rejects tel: without digits', () => {
    const result = validateUrl('tel:abcdef')
    expect(result.isValid).toBe(false)
    expect(result.messageKey).toBe('invalidPhone')
  })
})

describe('isWebUrl', () => {
  it('returns true for http URL', () => {
    expect(isWebUrl('http://example.com')).toBe(true)
  })

  it('returns true for https URL', () => {
    expect(isWebUrl('https://example.com/path?q=1')).toBe(true)
  })

  it('returns false for tel: URL', () => {
    expect(isWebUrl('tel:+82101234')).toBe(false)
  })

  it('returns false for app scheme URL', () => {
    expect(isWebUrl('kakaotalk://open')).toBe(false)
  })

  it('returns false for invalid URL', () => {
    expect(isWebUrl('not a valid url')).toBe(false)
  })
})

describe('isAppScheme', () => {
  it('returns true for custom app scheme', () => {
    expect(isAppScheme('kakaotalk://open')).toBe(true)
  })

  it('returns true for telegram scheme', () => {
    expect(isAppScheme('telegram://send?text=hi')).toBe(true)
  })

  it('returns true for mailto', () => {
    expect(isAppScheme('mailto:test@example.com')).toBe(true)
  })

  it('returns false for http URL', () => {
    expect(isAppScheme('http://example.com')).toBe(false)
  })

  it('returns false for https URL', () => {
    expect(isAppScheme('https://example.com')).toBe(false)
  })

  it('returns false for invalid URL', () => {
    expect(isAppScheme('just text')).toBe(false)
  })
})

describe('getUrlType', () => {
  it('returns web for http URL', () => {
    expect(getUrlType('http://example.com')).toBe('web')
  })

  it('returns web for https URL', () => {
    expect(getUrlType('https://example.com/page')).toBe('web')
  })

  it('returns email for mailto URL', () => {
    expect(getUrlType('mailto:user@example.com')).toBe('email')
  })

  it('returns tel for tel: URL', () => {
    expect(getUrlType('tel:+821012345678')).toBe('tel')
  })

  it('returns tel for sms: URL', () => {
    expect(getUrlType('sms:+821012345678')).toBe('tel')
  })

  it('returns app for custom app scheme', () => {
    expect(getUrlType('kakaotalk://chat')).toBe('app')
  })

  it('returns other for unparseable URL', () => {
    expect(getUrlType('not a url at all')).toBe('other')
  })
})

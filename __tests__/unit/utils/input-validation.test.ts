import {
  validateURL,
  escapeHTML,
  detectXSS,
  detectPathTraversal,
  detectSQLInjection,
  sanitizeInput,
  validateFilename,
  validateInput,
} from '@withwiz/utils/input-validation'

describe('validateURL', () => {
  it('accepts a valid https URL', () => {
    const result = validateURL('https://example.com/path')
    expect(result.valid).toBe(true)
    expect(result.sanitized).toContain('https://example.com/path')
  })

  it('accepts a valid http URL', () => {
    const result = validateURL('http://example.com')
    expect(result.valid).toBe(true)
  })

  it('rejects javascript: scheme', () => {
    const result = validateURL('javascript:alert(1)')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Dangerous URL scheme')
  })

  it('rejects data: scheme', () => {
    const result = validateURL('data:text/html,<script>alert(1)</script>')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Dangerous URL scheme')
  })

  it('rejects localhost by default', () => {
    const result = validateURL('http://localhost:3000')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Internal URLs')
  })

  it('rejects 127.0.0.1 by default', () => {
    const result = validateURL('http://127.0.0.1:8080')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Internal URLs')
  })

  it('allows localhost when allowLocalhost is true', () => {
    const result = validateURL('http://localhost:3000', { allowLocalhost: true })
    expect(result.valid).toBe(true)
  })

  it('rejects URL exceeding maxLength', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2100)
    const result = validateURL(longUrl)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('maximum length')
  })

  it('respects custom maxLength option', () => {
    const result = validateURL('https://example.com/long-path', { maxLength: 10 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('maximum length of 10')
  })

  it('rejects URL without protocol when requireProtocol is true', () => {
    const result = validateURL('example.com', { requireProtocol: true })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('must include a protocol')
  })

  it('accepts URL without protocol when requireProtocol is false', () => {
    const result = validateURL('example.com', { requireProtocol: false })
    expect(result.valid).toBe(true)
    expect(result.sanitized).toContain('https://example.com')
  })

  it('allows custom schemes via allowedSchemes option', () => {
    const result = validateURL('custom://resource', { allowedSchemes: ['custom:'] })
    expect(result.valid).toBe(true)
  })

  it('rejects empty string', () => {
    const result = validateURL('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('URL is required')
  })

  it('rejects non-string input', () => {
    const result = validateURL(null as any)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('URL is required')
  })

  it('rejects invalid URL format', () => {
    const result = validateURL('http://', { requireProtocol: true })
    expect(result.valid).toBe(false)
  })
})

describe('escapeHTML', () => {
  it('escapes ampersand', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b')
  })

  it('escapes less-than sign', () => {
    expect(escapeHTML('<div>')).toBe('&lt;div&gt;')
  })

  it('escapes greater-than sign', () => {
    expect(escapeHTML('a > b')).toBe('a &gt; b')
  })

  it('escapes double quotes', () => {
    expect(escapeHTML('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHTML("it's")).toBe('it&#x27;s')
  })

  it('escapes all special characters together', () => {
    expect(escapeHTML('<a href="x" onclick=\'y\'>&')).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#x27;y&#x27;&gt;&amp;'
    )
  })

  it('returns empty string for non-string input', () => {
    expect(escapeHTML(123 as any)).toBe('')
    expect(escapeHTML(null as any)).toBe('')
    expect(escapeHTML(undefined as any)).toBe('')
  })

  it('returns the same string when no special characters', () => {
    expect(escapeHTML('hello world')).toBe('hello world')
  })
})

describe('detectXSS', () => {
  it('detects script tags', () => {
    expect(detectXSS('<script>alert("xss")</script>')).toBe(true)
  })

  it('detects event handlers', () => {
    expect(detectXSS('<img onerror=alert(1)>')).toBe(true)
    expect(detectXSS('<div onclick=steal()>')).toBe(true)
  })

  it('detects javascript: URLs', () => {
    expect(detectXSS('javascript:void(0)')).toBe(true)
  })

  it('detects iframe tags', () => {
    expect(detectXSS('<iframe src="evil.com">')).toBe(true)
  })

  it('detects eval calls', () => {
    expect(detectXSS('eval("malicious")')).toBe(true)
  })

  it('returns false for clean text', () => {
    expect(detectXSS('Hello, this is a normal sentence.')).toBe(false)
  })

  it('returns false for non-string input', () => {
    expect(detectXSS(42 as any)).toBe(false)
    expect(detectXSS(null as any)).toBe(false)
  })
})

describe('detectPathTraversal', () => {
  it('detects ../ sequences', () => {
    expect(detectPathTraversal('../etc/passwd')).toBe(true)
    expect(detectPathTraversal('path/../../secret')).toBe(true)
  })

  it('detects URL-encoded ..', () => {
    expect(detectPathTraversal('%2e%2e/etc/passwd')).toBe(true)
  })

  it('detects double-encoded variants', () => {
    expect(detectPathTraversal('%252e%252e/secret')).toBe(true)
  })

  it('detects backslash traversal', () => {
    expect(detectPathTraversal('..\\windows\\system32')).toBe(true)
  })

  it('returns false for clean paths', () => {
    expect(detectPathTraversal('images/photo.jpg')).toBe(false)
  })

  it('returns false for non-string input', () => {
    expect(detectPathTraversal(undefined as any)).toBe(false)
  })
})

describe('detectSQLInjection', () => {
  it('detects SELECT statement', () => {
    expect(detectSQLInjection('SELECT * FROM users')).toBe(true)
  })

  it('detects DROP TABLE', () => {
    expect(detectSQLInjection('DROP TABLE users')).toBe(true)
  })

  it('detects UNION keyword', () => {
    expect(detectSQLInjection('1 UNION SELECT password FROM users')).toBe(true)
  })

  it('detects SQL comment patterns', () => {
    expect(detectSQLInjection("admin'--")).toBe(true)
  })

  it('detects block comment pattern', () => {
    expect(detectSQLInjection("admin/* comment */")).toBe(true)
  })

  it("detects OR 1=1 pattern", () => {
    expect(detectSQLInjection("' OR '1")).toBe(true)
  })

  it('returns false for normal text', () => {
    expect(detectSQLInjection('Hello world, how are you?')).toBe(false)
  })

  it('returns false for non-string input', () => {
    expect(detectSQLInjection(null as any)).toBe(false)
  })
})

describe('sanitizeInput', () => {
  it('trims whitespace by default', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('does not trim when trim option is false', () => {
    expect(sanitizeInput('  hello  ', { trim: false })).toBe('  hello  ')
  })

  it('escapes HTML by default', () => {
    expect(sanitizeInput('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('preserves HTML when allowHTML is true', () => {
    expect(sanitizeInput('<b>bold</b>', { allowHTML: true })).toBe('<b>bold</b>')
  })

  it('removes NULL bytes', () => {
    expect(sanitizeInput('hello\0world')).toBe('helloworld')
  })

  it('removes control characters', () => {
    expect(sanitizeInput('hello\x01\x02world')).toBe('helloworld')
  })

  it('preserves tabs and newlines', () => {
    expect(sanitizeInput('line1\nline2\ttab', { allowHTML: true })).toBe('line1\nline2\ttab')
  })

  it('enforces maxLength', () => {
    const result = sanitizeInput('a'.repeat(200), { maxLength: 50 })
    expect(result.length).toBe(50)
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeInput(42 as any)).toBe('')
    expect(sanitizeInput(null as any)).toBe('')
  })
})

describe('validateFilename', () => {
  it('accepts a valid filename', () => {
    const result = validateFilename('document.pdf')
    expect(result.valid).toBe(true)
    expect(result.sanitized).toBe('document.pdf')
  })

  it('accepts filenames with hyphens and underscores', () => {
    const result = validateFilename('my-file_v2.txt')
    expect(result.valid).toBe(true)
    expect(result.sanitized).toBe('my-file_v2.txt')
  })

  it('rejects .exe extension', () => {
    const result = validateFilename('virus.exe')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('.exe')
  })

  it('rejects .php extension', () => {
    const result = validateFilename('shell.php')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('.php')
  })

  it('rejects .bat extension', () => {
    const result = validateFilename('script.bat')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('.bat')
  })

  it('detects path traversal in filename', () => {
    const result = validateFilename('../../../etc/passwd')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Path traversal')
  })

  it('rejects empty filename', () => {
    const result = validateFilename('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Filename is required')
  })

  it('rejects non-string input', () => {
    const result = validateFilename(null as any)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Filename is required')
  })

  it('sanitizes special characters to underscores', () => {
    const result = validateFilename('file name (1).pdf')
    expect(result.valid).toBe(true)
    expect(result.sanitized).toContain('_')
    expect(result.sanitized).not.toContain(' ')
    expect(result.sanitized).not.toContain('(')
  })
})

describe('validateInput', () => {
  it('delegates url type to validateURL', () => {
    const result = validateInput('https://example.com', 'url')
    expect(result.valid).toBe(true)
  })

  it('delegates filename type to validateFilename', () => {
    const result = validateInput('report.pdf', 'filename')
    expect(result.valid).toBe(true)
  })

  it('rejects text with XSS pattern', () => {
    const result = validateInput('<script>alert(1)</script>', 'text')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('XSS')
  })

  it('rejects text with SQL injection pattern', () => {
    const result = validateInput('DROP TABLE users', 'text')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('SQL Injection')
  })

  it('accepts clean text and returns sanitized output', () => {
    const result = validateInput('Hello world', 'text')
    expect(result.valid).toBe(true)
    expect(result.sanitized).toBe('Hello world')
  })

  it('rejects html with dangerous patterns', () => {
    const result = validateInput('<script>evil()</script>', 'html')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Dangerous HTML')
  })

  it('accepts safe html content', () => {
    const result = validateInput('Hello <b>world</b>', 'html')
    expect(result.valid).toBe(true)
    expect(result.sanitized).toBe('Hello <b>world</b>')
  })
})

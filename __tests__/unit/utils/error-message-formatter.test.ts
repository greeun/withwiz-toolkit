import {
  formatRedisError,
  formatDatabaseError,
  formatGenericError,
} from '@withwiz/utils/error-message-formatter'

describe('formatRedisError', () => {
  it('returns user-friendly message for rate limit exceeded with details', () => {
    const msg = 'max requests limit exceeded Limit: 10000 Usage: 10001'
    const result = formatRedisError(msg)
    expect(result).toContain('Redis request limit exceeded')
    expect(result).toContain('10K')
  })

  it('returns generic rate limit message when no Limit/Usage details', () => {
    const result = formatRedisError('max requests limit exceeded')
    expect(result).toBe('Redis request limit exceeded. Please check your Redis provider plan.')
  })

  it('returns timeout message for timeout error', () => {
    expect(formatRedisError('Connection timeout after 5000ms')).toBe(
      'Redis connection timeout. Please check network connectivity.'
    )
  })

  it('returns timeout message for ETIMEDOUT', () => {
    expect(formatRedisError('connect ETIMEDOUT 10.0.0.1:6379')).toBe(
      'Redis connection timeout. Please check network connectivity.'
    )
  })

  it('returns auth failure message for NOAUTH', () => {
    expect(formatRedisError('NOAUTH Authentication required')).toBe(
      'Redis authentication failed. Please check your credentials.'
    )
  })

  it('returns auth failure message for invalid password', () => {
    expect(formatRedisError('ERR invalid password')).toBe(
      'Redis authentication failed. Please check your credentials.'
    )
  })

  it('returns connection refused message', () => {
    expect(formatRedisError('connect ECONNREFUSED 127.0.0.1:6379')).toBe(
      'Redis connection refused. Please check Redis server status.'
    )
  })

  it('returns server not found message for ENOTFOUND', () => {
    expect(formatRedisError('getaddrinfo ENOTFOUND redis.example.com')).toBe(
      'Redis server not found. Please check the Redis URL.'
    )
  })

  it('truncates messages longer than 100 characters', () => {
    const longMessage = 'a'.repeat(150)
    const result = formatRedisError(longMessage)
    expect(result.length).toBe(103)
    expect(result.endsWith('...')).toBe(true)
  })

  it('removes ERR prefix from message', () => {
    const result = formatRedisError('ERR some custom error')
    expect(result).toBe('some custom error')
    expect(result).not.toContain('ERR')
  })

  it('returns default message for empty input', () => {
    expect(formatRedisError('')).toBe('Unknown Redis error')
  })
})

describe('formatDatabaseError', () => {
  it('returns timeout message for timeout error', () => {
    expect(formatDatabaseError('Query timeout after 30000ms')).toBe(
      'Database connection timeout. Please check network connectivity.'
    )
  })

  it('returns connection refused message', () => {
    expect(formatDatabaseError('connect ECONNREFUSED 127.0.0.1:5432')).toBe(
      'Database connection refused. Please check database server status.'
    )
  })

  it('returns auth failure message', () => {
    expect(formatDatabaseError('password authentication failed for user "admin"')).toBe(
      'Database authentication failed. Please check your credentials.'
    )
  })

  it('returns connection limit message', () => {
    expect(formatDatabaseError('too many connections for role')).toBe(
      'Database connection limit reached. Please try again later.'
    )
  })

  it('returns connection limit message for connection limit variant', () => {
    expect(formatDatabaseError('connection limit reached')).toBe(
      'Database connection limit reached. Please try again later.'
    )
  })

  it('truncates messages longer than 100 characters', () => {
    const longMessage = 'b'.repeat(120)
    const result = formatDatabaseError(longMessage)
    expect(result.length).toBe(103)
    expect(result.endsWith('...')).toBe(true)
  })

  it('passes through short unrecognized messages as-is', () => {
    expect(formatDatabaseError('unique constraint violated')).toBe('unique constraint violated')
  })

  it('returns default message for empty input', () => {
    expect(formatDatabaseError('')).toBe('Unknown database error')
  })
})

describe('formatGenericError', () => {
  it('returns default message for empty string', () => {
    expect(formatGenericError('')).toBe('Unknown error occurred')
  })

  it('passes through normal-length messages unchanged', () => {
    expect(formatGenericError('Something went wrong')).toBe('Something went wrong')
  })

  it('truncates messages longer than 150 characters', () => {
    const longMessage = 'x'.repeat(200)
    const result = formatGenericError(longMessage)
    expect(result.length).toBe(153)
    expect(result.endsWith('...')).toBe(true)
  })

  it('keeps messages of exactly 150 characters unchanged', () => {
    const msg = 'z'.repeat(150)
    expect(formatGenericError(msg)).toBe(msg)
  })
})

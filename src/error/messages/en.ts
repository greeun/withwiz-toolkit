/**
 * English Error Messages
 */

import type { TErrorMessages } from './types';

export const enMessages: TErrorMessages = {
  // ============================================
  // Validation Errors (400xx)
  // ============================================
  40001: {
    title: 'Please check your input',
    description: 'Some information you entered is incorrect.',
    action: 'Please review your input.',
  },
  40002: {
    title: 'Cannot process request',
    description: 'The request format is invalid.',
    action: 'Please refresh the page.',
  },
  40003: {
    title: 'Invalid input',
    description: 'The format is not allowed.',
    action: 'Please enter in the correct format.',
  },
  40004: {
    title: 'Required information is missing',
    description: 'Required fields are empty.',
    action: 'Please fill in all required fields.',
  },
  40005: {
    title: 'Please check URL format',
    description: 'Please enter a URL starting with https://.',
    action: 'Example: https://example.com',
  },
  40006: {
    title: 'Please check email format',
    description: 'This is not a valid email address.',
    action: 'Example: user@example.com',
  },
  40007: {
    title: 'Stronger password required',
    description: '8+ characters with letters, numbers, and symbols',
    action: 'Please set a more complex password.',
  },
  40008: {
    title: 'Please check alias format',
    description: 'Only letters, numbers, and hyphens (-) allowed',
    action: 'Example: my-link-123',
  },

  // ============================================
  // Authentication Errors (401xx)
  // ============================================
  40101: {
    title: 'Login required',
    description: 'This feature requires authentication.',
    action: 'Please login and try again.',
  },
  40102: {
    title: 'Invalid authentication',
    description: 'Your login session is not valid.',
    action: 'Please login again.',
  },
  40103: {
    title: 'Session expired',
    description: 'Your session has expired for security.',
    action: 'Please login again.',
  },
  40104: {
    title: 'Password required',
    description: 'You must enter a password.',
    action: 'Please enter the password.',
  },
  40105: {
    title: 'Incorrect password',
    description: 'The password is incorrect.',
    action: 'Please check again.',
  },
  40106: {
    title: 'Login failed',
    description: 'Email or password is incorrect.',
    action: 'Please try again.',
  },
  40107: {
    title: 'Session ended',
    description: 'You have been automatically logged out.',
    action: 'Please login again.',
  },

  // ============================================
  // Permission Errors (403xx)
  // ============================================
  40304: {
    title: 'Access denied',
    description: 'You do not have permission for this feature.',
    action: 'Please contact the administrator.',
  },
  40305: {
    title: 'Email verification required',
    description: 'Please verify your email first.',
    action: 'Please check your mailbox.',
  },
  40308: {
    title: 'Account disabled',
    description: 'This account cannot use the service.',
    action: 'Please contact customer support.',
  },
  40309: {
    title: 'Account locked',
    description: 'Account locked due to failed login attempts.',
    action: 'Please try again later.',
  },

  // ============================================
  // Resource Not Found (404xx)
  // ============================================
  40401: {
    title: 'Not found',
    description: 'The requested item does not exist.',
    action: 'Please check the address.',
  },
  40402: {
    title: 'User not found',
    description: 'The user does not exist.',
  },
  40403: {
    title: 'Link not found',
    description: 'The shortened link does not exist.',
    action: 'Please check the link address.',
  },
  40408: {
    title: 'Tag not found',
    description: 'The tag does not exist.',
  },
  40409: {
    title: 'Favorite not found',
    description: 'The item does not exist.',
  },
  40410: {
    title: 'Group not found',
    description: 'The group does not exist.',
  },

  // ============================================
  // Conflict Errors (409xx)
  // ============================================
  40904: {
    title: 'Conflict occurred',
    description: 'Conflicts with existing data.',
    action: 'Please try again later.',
  },
  40905: {
    title: 'Already exists',
    description: 'An identical item already exists.',
    action: 'Please use a different value.',
  },
  40906: {
    title: 'Email already registered',
    description: 'This email is already in use by another account.',
    action: 'Please use a different email.',
  },
  40907: {
    title: 'Alias already in use',
    description: 'This alias is being used by another link.',
    action: 'Please enter a different alias.',
  },

  // ============================================
  // Business Logic Errors (422xx)
  // ============================================
  42201: {
    title: 'Cannot process',
    description: 'Cannot be processed in the current state.',
    action: 'Please check the conditions.',
  },
  42202: {
    title: 'Operation not allowed',
    description: 'This operation is not possible in the current state.',
  },
  42203: {
    title: 'Usage limit exceeded',
    description: 'You have exceeded the limit.',
    action: 'Please consider upgrading your plan.',
  },
  42204: {
    title: 'Link expired',
    description: 'The validity period has passed.',
    action: 'Please create a new link.',
  },
  42205: {
    title: 'Link disabled',
    description: 'Usage has been stopped.',
    action: 'Please contact the owner.',
  },
  // 42206, 42207: moved to 401xx → see 40104, 40105 below
  42208: {
    title: 'Alias not allowed',
    description: 'This is a system reserved word.',
    action: 'Please choose a different alias.',
  },
  42209: {
    title: 'Already in favorites',
    description: 'Already added.',
  },
  42210: {
    title: 'Cannot delete',
    description: 'Cannot delete your own admin account.',
  },
  42211: {
    title: 'File too large',
    description: 'The maximum size has been exceeded.',
    action: 'Please select a smaller file.',
  },
  42212: {
    title: 'Unsupported file format',
    description: 'Cannot upload.',
    action: 'Please check supported formats.',
  },

  // ============================================
  // Rate Limiting (429xx)
  // ============================================
  42901: {
    title: 'Please slow down',
    description: 'Too many requests.',
    action: 'Please try again in a moment.',
  },
  42902: {
    title: 'Daily limit reached',
    description: 'You have reached the daily limit.',
    action: 'Please try again tomorrow.',
  },
  42903: {
    title: 'API quota exceeded',
    description: 'API limit exceeded.',
    action: 'Please consider upgrading your plan.',
  },

  // ============================================
  // Server Errors (500xx)
  // ============================================
  50001: {
    title: 'Internal server error',
    description: 'An internal server problem has occurred.',
    action: 'Please try again later.',
  },
  50002: {
    title: 'Temporary error',
    description: 'Will be restored soon.',
    action: 'Please try again later.',
  },
  50003: {
    title: 'Data processing error',
    description: 'A problem occurred while processing data.',
    action: 'Please try again later.',
  },
  50006: {
    title: 'Failed to send email',
    description: 'Email sending failed.',
    action: 'Please try again later.',
  },
  50007: {
    title: 'Temporary error',
    description: 'There is a problem with cache processing.',
    action: 'Please refresh the page.',
  },
  50008: {
    title: 'File upload failed',
    description: 'There was a problem saving the file.',
    action: 'Please try again.',
  },

  // ============================================
  // Service Unavailable (503xx)
  // ============================================
  50304: {
    title: 'External service connection failed',
    description: 'The external service is not responding.',
    action: 'Please try again later.',
  },
  50305: {
    title: 'Service under maintenance',
    description: 'Maintenance in progress.',
    action: 'Please visit again later.',
  },

  // ============================================
  // Security Errors (403xx - 71~79)
  // ============================================
  40371: {
    title: 'Access blocked',
    description: 'Blocked by security policy.',
    action: 'Please try again using the normal method.',
  },
  40372: {
    title: 'Security validation failed',
    description: 'Security token has expired.',
    action: 'Please refresh the page.',
  },
  40373: {
    title: 'URL not allowed',
    description: 'This URL is blocked for security reasons.',
    action: 'Please use a different URL.',
  },
  40374: {
    title: 'Suspicious activity detected',
    description: 'Temporarily restricted.',
    action: 'Please contact customer support.',
  },
  40375: {
    title: 'IP blocked',
    description: 'Blocked by security policy.',
    action: 'Please contact customer support.',
  },
  40376: {
    title: 'CORS policy violation',
    description: 'Request from an unauthorized origin.',
    action: 'Please access from the correct address.',
  },
};

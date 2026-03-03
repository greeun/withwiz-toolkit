import { SignJWT } from 'jose';
import { webcrypto } from 'crypto';

globalThis.crypto = webcrypto;

const secret = new TextEncoder().encode('test-secret-key-that-is-at-least-32-characters-long');
const payload = { id: 'test', userId: 'test', email: 'test@example.com', role: 'USER' };

console.log('Secret type:', secret.constructor.name);
console.log('Secret length:', secret.length);

try {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
  console.log('Success!', jwt.substring(0, 30));
} catch (error) {
  console.error('Error:', error.message);
}

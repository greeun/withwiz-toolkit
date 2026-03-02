# @withwiz/validators

입력 검증 유틸리티로 비밀번호, 이메일 등의 검증 기능을 제공합니다.

## 비밀번호 검증

```typescript
import { PasswordValidator } from '@withwiz/validators';

// 기본 검증
const result = PasswordValidator.validate('MyPassword123');
console.log(result.isValid);  // true
console.log(result.errors);   // []

// 커스텀 옵션
const result2 = PasswordValidator.validate('password', {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialChar: true,
});
```

## 검증 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `minLength` | 8 | 최소 길이 |
| `maxLength` | 128 | 최대 길이 |
| `requireUppercase` | false | 대문자 필수 |
| `requireLowercase` | false | 소문자 필수 |
| `requireNumber` | true | 숫자 필수 |
| `requireSpecialChar` | false | 특수문자 필수 |

## 강도 측정

```typescript
import { PasswordValidator, PasswordStrength } from '@withwiz/validators';

const strength = PasswordValidator.getStrength('MyP@ssw0rd!');
// PasswordStrength.STRONG

// 강도 레벨
PasswordStrength.WEAK     // 0
PasswordStrength.FAIR     // 1
PasswordStrength.GOOD     // 2
PasswordStrength.STRONG   // 3
```

## Zod 스키마

```typescript
import { defaultPasswordSchema, strongPasswordSchema } from '@withwiz/validators';

// 기본 스키마 사용
const result = defaultPasswordSchema.safeParse('password');

// 강화된 스키마 사용
const result2 = strongPasswordSchema.safeParse('WeakPwd');
```

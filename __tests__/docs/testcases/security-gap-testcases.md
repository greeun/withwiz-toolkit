# Security Gap Testcases — api-key

배치: `__tests__/security/api-key/api-key-secrets.test.ts` (신규).

| TC | Given | When | Then |
|----|-------|------|------|
| TC-SEC-AK-001 | fake repo 캡처 | generateApiKey | create.key === sha256(rawKey), rawKey 원문 미포함, 64 hex |
| TC-SEC-AK-002 | 만료/무효 키 | validateApiKey 실패 | message에 rawKey·해시 부분문자열 없음 |
| TC-SEC-AK-003 | 발급 키 레코드 | getApiKey → keyPreview | 원문 rawKey 미포함, `앞10...뒤4` 해시 축약 |
| TC-SEC-AK-004 | 1000회 generateRawKey | Set 크기 비교 | 중복 0 + prefix/길이 불변 |

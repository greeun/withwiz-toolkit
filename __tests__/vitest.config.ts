import { defineConfig, configDefaults } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@withwiz/toolkit': resolve(__dirname, '../src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(__dirname, './setup.ts')],
    // configDefaults.exclude 를 펼쳐야 한다. 이 배열은 기본값을 덮어쓰므로,
    // 직접 나열하면 중첩된 node_modules 가 제외 대상에서 빠진다.
    // .claude/worktrees 에는 같은 저장소의 워크트리가 들어오는데, 그 안의
    // __tests__ 까지 수집되면 테스트가 두 벌씩 실행된다.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})

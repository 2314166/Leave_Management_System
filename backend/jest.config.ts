import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: {
          module: 'commonjs',
          target: 'ES2022',
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          isolatedModules: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  // Framework packages are replaced by light stand-ins in unit tests
  moduleNameMapper: {
    '^@nestjs/common$': '<rootDir>/test/stubs/index.ts',
    '^@nestjs/core$': '<rootDir>/test/stubs/index.ts',
    '^@nestjs/jwt$': '<rootDir>/test/stubs/index.ts',
    '^bcryptjs$': '<rootDir>/test/stubs/index.ts',
    '^\\./prisma\\.service$': '<rootDir>/test/stubs/index.ts',
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
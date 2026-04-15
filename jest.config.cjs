/** @type {import('jest').Config} */
module.exports = {
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: false,
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["**/tests/**/*.test.ts"],
  testTimeout: 30000,
  roots: ["<rootDir>"],
  moduleNameMapper: {
    "^@plugin-config/(.*)$": "<rootDir>/contributor-rewards-with-config/$1",
    "^@proposals/(.*)$": "<rootDir>/proposals/$1",
  },
};

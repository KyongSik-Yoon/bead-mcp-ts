# Repository Guidelines

## Project Structure & Modules
- Source code lives in `src/` (`index.ts` entrypoint, `beads.ts` MCP logic).
- Built JavaScript output goes to `build/` via TypeScript.
- This AGENTS file applies to the entire repository; keep new modules under `src/` unless there is a strong reason otherwise.

## Build, Test, and Development
- `npm install` – install dependencies.
- `npm run build` – compile TypeScript to `build/`.
- `npm start` – run the built server (`build/index.js`).
- Tests are not yet implemented; avoid relying on the default `npm test` script.

## Coding Style & Naming
- Language: TypeScript (`"type": "module"` ESM style).
- Use 2-space indentation and keep imports ordered by module path.
- Prefer explicit types on public functions and exported values.
- Name files and modules in `camelCase` or `kebab-case` (e.g., `beads.ts`, `sessionStore.ts`); exported classes/types use `PascalCase`, functions and variables use `camelCase`.

## Testing Guidelines
- When adding tests, colocate them near source (e.g., `src/index.test.ts`) or under a future `tests/` directory; use a common framework such as Jest or Vitest.
- Ensure new features include basic tests for success and typical failure cases.
- Update `package.json` to make `npm test` execute the test runner once tests are introduced.

## Commit & Pull Request Guidelines
- Use clear, imperative commit messages (e.g., `Add MCP beads handler`, `Fix build script for ESM`).
- Keep pull requests focused: one logical change per PR, with a concise description and any relevant `npm` commands to reproduce or verify behavior.
- Reference related issues in the PR description (e.g., `Fixes #12`), and note any breaking changes or configuration steps needed for adopters.


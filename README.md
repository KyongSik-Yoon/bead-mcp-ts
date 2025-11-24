# Beads MCP (TypeScript)

English is the default README.  
For Korean documentation, see [README.ko.md](README.ko.md).

## Overview

This repository is a TypeScript implementation of a Model Context Protocol (MCP) server
that integrates with the [`beads`](https://github.com/steveyegge/beads) issue tracker
and agent memory system.

Like the Python-based `beads-mcp`, this server shells out to the `bd` CLI to manage
issues. It never manipulates local JSON files directly; all data lives in the beads
database.

## MCP Tools

This server exposes the same MCP tool names and behavior as the official Python
`beads-mcp` README. All tools support an optional `workspace_root` parameter.

- `set_context` – set the default `workspace_root` for subsequent calls
- `where_am_i` – show the current context and database path
- `ready` – list issues that are ready to work on (no blocking dependencies)
- `list` – list issues filtered by status, priority, type, assignee, etc.
- `show` – show details for a single issue (including dependencies)
- `create` – create a new issue (bug/feature/task/epic/chore, dependencies, etc.)
- `update` – update an existing issue  
  - `status="closed"` → internally calls the `close` tool  
  - `status="open"` → internally calls the `reopen` tool
- `close` – close an issue (optionally including a `reason`)
- `reopen` – reopen one or more issues
- `dep` – add dependencies between issues  
  (`blocks`, `related`, `parent-child`, `discovered-from`)
- `stats` – aggregate stats by status, including blocked/ready and lead time
- `blocked` – list issues that currently have blocking dependencies
- `init` – initialize `.beads/` and a database in the current directory (optional prefix)
- `debug_env` – debug output for working directory and environment variables
- `inspect_migration` – show the migration plan and database state
- `get_schema_info` – show current database schema information
- `repair_deps` – detect orphaned dependencies and optionally repair them
- `detect_pollution` – detect/clean test issues that leaked into a production database
- `validate` – comprehensive health check (orphans, duplicates, pollution, conflicts, etc.)

### Resources

- `beads://quickstart` – returns the same quickstart guide as `bd quickstart`

## Usage

1. Install dependencies and build:

   ```bash
   npm install
   npm run build
   ```

2. Configure your MCP client (e.g., Claude Desktop, Cursor) to use this server:
   - Command: `node`
   - Args: `[path-to-this-repo]/build/index.js`

## Environment Variables

This implementation supports the same environment variables as the official
Python `beads-mcp` README (all optional):

- `BEADS_USE_DAEMON` – ignored for now; this server always uses the CLI
- `BEADS_PATH` – path to the `bd` executable  
  - Default: search `bd` on `PATH`, then `~/.local/bin/bd`
- `BEADS_DB` – path to the beads database file (forwarded to the CLI when needed)
- `BEADS_WORKING_DIR` – default working directory for `bd` commands  
  - Calling the `set_context` tool sets/updates this value.
- `BEADS_ACTOR` – actor name used for audit logging (default: `$USER`)
- `BEADS_NO_AUTO_FLUSH` – when `true`/`1`, disables automatic JSONL auto-flush
- `BEADS_NO_AUTO_IMPORT` – when `true`/`1`, disables automatic JSONL auto-import
- `BEADS_REQUIRE_CONTEXT` – when `1`, write tools require `workspace_root`
  or a prior `set_context` call

## Workspace & Multi-Repo

- By default, the MCP process `cwd` is used as the working directory.
- When you call `set_context(workspace_root=...)`:
  - The path is normalized to the git repository root when possible.
  - `BEADS_WORKING_DIR` and `BEADS_DB` are set.
  - All tools that omit `workspace_root` will use this value.
- All tools (`ready`, `list`, `show`, `create`, `update`, `close`, `reopen`,
  `dep`, `stats`, `blocked`, etc.) accept a `workspace_root` parameter so you can
  target a specific project explicitly.

## Data Storage (`bd` CLI)

All persistent data is managed by the `bd` CLI.

- The `.beads/` directory and database file are automatically discovered by `bd`
  relative to the working directory.
- The `init` tool calls `bd init` internally to create a new database.

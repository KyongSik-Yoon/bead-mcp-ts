import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BdClient } from "./bdClient.js";
const workspaceContext = {};
function getEffectiveWorkspaceRoot(workspaceRoot) {
    if (workspaceRoot && workspaceRoot.trim() !== "") {
        return workspaceRoot;
    }
    if (workspaceContext.BEADS_WORKING_DIR) {
        return workspaceContext.BEADS_WORKING_DIR;
    }
    if (process.env.BEADS_WORKING_DIR && process.env.BEADS_WORKING_DIR.trim() !== "") {
        return process.env.BEADS_WORKING_DIR;
    }
    return undefined;
}
function ensureWriteContext(workspaceRoot) {
    if (process.env.BEADS_REQUIRE_CONTEXT === "1") {
        const effective = getEffectiveWorkspaceRoot(workspaceRoot);
        if (!effective) {
            throw new Error("Context not set. Either provide workspace_root parameter or call set_context() first.");
        }
    }
}
async function findBeadsDb(workspaceRoot) {
    const fs = await import("fs");
    const path = await import("path");
    let current = path.resolve(workspaceRoot);
    // Walk up parents looking for .beads/*.db
    // Matches Python _find_beads_db behavior.
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const beadsDir = path.join(current, ".beads");
        if (fs.existsSync(beadsDir) && fs.statSync(beadsDir).isDirectory()) {
            const entries = fs.readdirSync(beadsDir);
            const dbFile = entries.find((name) => name.endsWith(".db"));
            if (dbFile) {
                return path.join(beadsDir, dbFile);
            }
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return undefined;
}
async function resolveWorkspaceRoot(input) {
    const childProcess = await import("child_process");
    const path = await import("path");
    try {
        const result = childProcess.spawnSync("git", ["rev-parse", "--show-toplevel"], {
            cwd: input,
            encoding: "utf-8",
        });
        if (result.status === 0 && result.stdout) {
            return result.stdout.trim();
        }
    }
    catch {
        // ignore and fall back to absolute path
    }
    return path.resolve(input);
}
const server = new McpServer({
    name: "beads-mcp",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
// Resource: beads://quickstart
server.registerResource("beads_quickstart", "beads://quickstart", {
    title: "Beads Quickstart Guide",
    description: "Quickstart guide for using beads (bd) CLI.",
}, async () => {
    const client = new BdClient();
    const text = await client.quickstart();
    return {
        contents: [
            {
                uri: "beads://quickstart",
                text,
            },
        ],
    };
});
// set_context
server.registerTool("set_context", {
    title: "Set beads workspace context",
    description: "Set the workspace root directory for all bd operations. Call this first for multi-repo setups.",
    inputSchema: {
        workspace_root: z.string().describe("Absolute path to workspace/project root directory"),
    },
}, async (args) => {
    const resolvedRoot = await resolveWorkspaceRoot(args.workspace_root);
    workspaceContext.BEADS_WORKING_DIR = resolvedRoot;
    workspaceContext.BEADS_CONTEXT_SET = "1";
    process.env.BEADS_WORKING_DIR = resolvedRoot;
    process.env.BEADS_CONTEXT_SET = "1";
    const dbPath = await findBeadsDb(resolvedRoot);
    if (!dbPath) {
        delete workspaceContext.BEADS_DB;
        delete process.env.BEADS_DB;
        const message = `Context set successfully:\n` +
            `  Workspace root: ${resolvedRoot}\n` +
            `  Database: Not found (run 'bd init' to create)`;
        return {
            content: [{ type: "text", text: message }],
        };
    }
    workspaceContext.BEADS_DB = dbPath;
    process.env.BEADS_DB = dbPath;
    const message = `Context set successfully:\n` +
        `  Workspace root: ${resolvedRoot}\n` +
        `  Database: ${dbPath}`;
    return {
        content: [{ type: "text", text: message }],
    };
});
// where_am_i
server.registerTool("where_am_i", {
    title: "Show beads workspace context",
    description: "Show current workspace context and database path.",
    inputSchema: {
        workspace_root: z.string().optional(),
    },
}, async (_args) => {
    const contextSet = workspaceContext.BEADS_CONTEXT_SET || process.env.BEADS_CONTEXT_SET || undefined;
    if (!contextSet) {
        const message = "Context not set. Call set_context with your workspace root first.\n" +
            `Current process CWD: ${process.cwd()}\n` +
            `BEADS_WORKING_DIR (persistent): ${workspaceContext.BEADS_WORKING_DIR ?? "NOT SET"}\n` +
            `BEADS_WORKING_DIR (env): ${process.env.BEADS_WORKING_DIR ?? "NOT SET"}\n` +
            `BEADS_DB: ${workspaceContext.BEADS_DB ?? process.env.BEADS_DB ?? "NOT SET"}`;
        return {
            content: [{ type: "text", text: message }],
        };
    }
    const workingDir = workspaceContext.BEADS_WORKING_DIR ?? process.env.BEADS_WORKING_DIR ?? "NOT SET";
    const dbPath = workspaceContext.BEADS_DB ?? process.env.BEADS_DB ?? "NOT SET";
    const actor = process.env.BEADS_ACTOR ?? "NOT SET";
    const message = `Workspace root: ${workingDir}\n` +
        `Database: ${dbPath}\n` +
        `Actor: ${actor}`;
    return {
        content: [{ type: "text", text: message }],
    };
});
// ready
server.registerTool("ready", {
    title: "Find ready work",
    description: "Find tasks that have no blockers and are ready to be worked on.",
    inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        priority: z.number().int().min(0).max(4).optional(),
        assignee: z.string().optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { limit, priority, assignee, workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const issues = await client.ready({
        limit,
        priority,
        assignee,
    });
    // Strip deps for lighter payload (as in Python version)
    for (const issue of issues) {
        if (issue.dependencies)
            issue.dependencies = [];
        if (issue.dependents)
            issue.dependents = [];
    }
    const text = JSON.stringify(issues, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// list
server.registerTool("list", {
    title: "List issues",
    description: "List all issues with optional filters (status, priority, type, assignee).",
    inputSchema: {
        status: z
            .enum(["open", "in_progress", "blocked", "closed"])
            .optional()
            .describe("Filter by status"),
        priority: z
            .number()
            .int()
            .min(0)
            .max(4)
            .optional()
            .describe("Filter by priority (0-4, 0=highest)"),
        issue_type: z
            .enum(["bug", "feature", "task", "epic", "chore"])
            .optional()
            .describe("Filter by issue type"),
        assignee: z.string().optional().describe("Filter by assignee"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Maximum number of issues to return"),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { status, priority, issue_type, assignee, limit, workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const issues = await client.listIssues({
        status: status,
        priority,
        issue_type: issue_type,
        assignee,
        limit,
    });
    for (const issue of issues) {
        if (issue.dependencies)
            issue.dependencies = [];
        if (issue.dependents)
            issue.dependents = [];
    }
    const text = JSON.stringify(issues, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// show
server.registerTool("show", {
    title: "Show issue details",
    description: "Show detailed information about a specific issue including dependencies.",
    inputSchema: {
        issue_id: z.string().describe("Issue ID (e.g., bd-1)"),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { issue_id, workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const issue = await client.show({ issue_id });
    const text = JSON.stringify(issue, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// create
server.registerTool("create", {
    title: "Create issue",
    description: "Create a new issue (bug, feature, task, epic, or chore) with optional design and dependencies.",
    inputSchema: {
        title: z.string(),
        description: z.string().optional(),
        design: z.string().optional(),
        acceptance: z.string().optional(),
        external_ref: z.string().optional(),
        priority: z.number().int().min(0).max(4).optional(),
        issue_type: z.enum(["bug", "feature", "task", "epic", "chore"]).optional(),
        assignee: z.string().optional(),
        labels: z.array(z.string()).optional(),
        id: z.string().optional(),
        deps: z.array(z.string()).optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { title, description, design, acceptance, external_ref, priority, issue_type, assignee, labels, id, deps, workspace_root, } = args;
    ensureWriteContext(workspace_root);
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const issue = await client.create({
        title,
        description,
        design,
        acceptance,
        external_ref,
        priority,
        issue_type: issue_type,
        assignee,
        labels,
        id,
        deps,
    });
    const text = JSON.stringify(issue, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// update
server.registerTool("update", {
    title: "Update issue",
    description: "Update an existing issue (status, priority, design, notes, etc). Status 'closed'/'open' routes to close/reopen.",
    inputSchema: {
        issue_id: z.string(),
        status: z.enum(["open", "in_progress", "blocked", "closed"]).optional(),
        priority: z.number().int().min(0).max(4).optional(),
        assignee: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        design: z.string().optional(),
        acceptance_criteria: z.string().optional(),
        notes: z.string().optional(),
        external_ref: z.string().optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { issue_id, status, priority, assignee, title, description, design, acceptance_criteria, notes, external_ref, workspace_root, } = args;
    ensureWriteContext(workspace_root);
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    // Smart routing for lifecycle changes
    if (status === "closed") {
        const reason = notes || "Completed";
        const issues = await client.close({ issue_id, reason });
        const text = JSON.stringify(issues, null, 2);
        return {
            content: [{ type: "text", text }],
        };
    }
    if (status === "open") {
        const reason = notes || "Reopened";
        const issues = await client.reopen({ issue_ids: [issue_id], reason });
        const text = JSON.stringify(issues, null, 2);
        return {
            content: [{ type: "text", text }],
        };
    }
    const issue = await client.update({
        issue_id,
        status: status,
        priority,
        assignee,
        title,
        description,
        design,
        acceptance_criteria,
        notes,
        external_ref,
    });
    const text = JSON.stringify(issue, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// close
server.registerTool("close", {
    title: "Close issue",
    description: "Close (complete) an issue.",
    inputSchema: {
        issue_id: z.string(),
        reason: z.string().optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { issue_id, reason, workspace_root } = args;
    ensureWriteContext(workspace_root);
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const issues = await client.close({
        issue_id,
        reason: reason || "Completed",
    });
    const text = JSON.stringify(issues, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// reopen
server.registerTool("reopen", {
    title: "Reopen issues",
    description: "Reopen one or more closed issues.",
    inputSchema: {
        issue_ids: z.array(z.string()),
        reason: z.string().optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { issue_ids, reason, workspace_root } = args;
    ensureWriteContext(workspace_root);
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const issues = await client.reopen({
        issue_ids,
        reason: reason ?? null,
    });
    const text = JSON.stringify(issues, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// dep
server.registerTool("dep", {
    title: "Add dependency",
    description: "Add a dependency between issues. Types: blocks (hard blocker), related (soft link), parent-child (epic/subtask), discovered-from (found during work).",
    inputSchema: {
        issue_id: z.string(),
        depends_on_id: z.string(),
        dep_type: z
            .enum(["blocks", "related", "parent-child", "discovered-from"])
            .optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { issue_id, depends_on_id, dep_type, workspace_root } = args;
    ensureWriteContext(workspace_root);
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const type = dep_type ?? "blocks";
    try {
        await client.addDependency({
            issue_id,
            depends_on_id,
            dep_type: type,
        });
        const text = `Added dependency: ${issue_id} depends on ${depends_on_id} (${type})`;
        return {
            content: [{ type: "text", text }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
// stats
server.registerTool("stats", {
    title: "Project statistics",
    description: "Get statistics: total issues, open, in_progress, closed, blocked, ready, and average lead time.",
    inputSchema: {
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const stats = await client.stats();
    const text = JSON.stringify(stats, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// blocked
server.registerTool("blocked", {
    title: "Blocked issues",
    description: "Get blocked issues showing what dependencies are blocking them from being worked on.",
    inputSchema: {
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const issues = await client.blocked();
    const text = JSON.stringify(issues, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// init
server.registerTool("init", {
    title: "Initialize beads",
    description: "Initialize bd in current directory. Creates .beads/ directory and database with optional custom prefix for issue IDs.",
    inputSchema: {
        prefix: z.string().optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { prefix, workspace_root } = args;
    ensureWriteContext(workspace_root);
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const output = await client.init({ prefix: prefix ?? null });
    return {
        content: [{ type: "text", text: output }],
    };
});
// debug_env
server.registerTool("debug_env", {
    title: "Debug environment",
    description: "Debug tool: Show environment and working directory information.",
    inputSchema: {
        workspace_root: z.string().optional(),
    },
}, async (_args) => {
    const lines = [];
    lines.push("=== Working Directory Debug Info ===");
    lines.push(`os.getcwd(): ${process.cwd()}`);
    lines.push(`BEADS_WORKING_DIR env var: ${process.env.BEADS_WORKING_DIR ?? "NOT SET"}`);
    lines.push(`BEADS_PATH env var: ${process.env.BEADS_PATH ?? "NOT SET"}`);
    lines.push(`BEADS_DB env var: ${process.env.BEADS_DB ?? "NOT SET"}`);
    lines.push(`HOME: ${process.env.HOME ?? "NOT SET"}`);
    lines.push(`USER: ${process.env.USER ?? "NOT SET"}`);
    lines.push("");
    lines.push("=== All Environment Variables ===");
    const keys = Object.keys(process.env).filter((k) => !k.startsWith("_")).sort();
    for (const key of keys) {
        lines.push(`${key}=${process.env[key] ?? ""}`);
    }
    const text = lines.join("\n");
    return {
        content: [{ type: "text", text }],
    };
});
// inspect_migration
server.registerTool("inspect_migration", {
    title: "Inspect migration plan",
    description: "Get migration plan and database state for agent analysis.",
    inputSchema: {
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const result = await client.inspectMigration();
    const text = JSON.stringify(result, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// get_schema_info
server.registerTool("get_schema_info", {
    title: "Get schema info",
    description: "Get current database schema for inspection.",
    inputSchema: {
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const result = await client.getSchemaInfo();
    const text = JSON.stringify(result, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// repair_deps
server.registerTool("repair_deps", {
    title: "Repair dependencies",
    description: "Find and optionally fix orphaned dependency references.",
    inputSchema: {
        fix: z.boolean().optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { fix, workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const result = await client.repairDeps(fix ?? false);
    const text = JSON.stringify(result, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// detect_pollution
server.registerTool("detect_pollution", {
    title: "Detect test pollution",
    description: "Detect test issues that leaked into production database.",
    inputSchema: {
        clean: z.boolean().optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { clean, workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const result = await client.detectPollution(clean ?? false);
    const text = JSON.stringify(result, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
// validate
server.registerTool("validate", {
    title: "Validate database",
    description: "Run comprehensive database health checks (orphans, duplicates, pollution, conflicts).",
    inputSchema: {
        checks: z.string().optional(),
        fix_all: z.boolean().optional(),
        workspace_root: z.string().optional(),
    },
}, async (args) => {
    const { checks, fix_all, workspace_root } = args;
    const workspace = getEffectiveWorkspaceRoot(workspace_root);
    const client = new BdClient({ workspaceRoot: workspace });
    const result = await client.validate(checks ?? null, fix_all ?? false);
    const text = JSON.stringify(result, null, 2);
    return {
        content: [{ type: "text", text }],
    };
});
const transport = new StdioServerTransport();
await server.connect(transport);

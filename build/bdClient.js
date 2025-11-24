import { spawn } from "child_process";
import { loadBeadsConfig } from "./config.js";
export class BdError extends Error {
}
export class BdCommandError extends BdError {
    stderr;
    returncode;
    constructor(message, stderr = "", returncode = 1) {
        super(message);
        this.stderr = stderr;
        this.returncode = returncode;
    }
}
export class BdNotFoundError extends BdError {
    static installationMessage(attemptedPath) {
        return (`bd CLI not found at: ${attemptedPath}\n\n` +
            "The beads MCP server requires the bd CLI to be installed separately.\n\n" +
            "Install bd CLI:\n" +
            "  curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/install.sh | bash\n\n" +
            "Or visit: https://github.com/steveyegge/beads#installation\n\n" +
            "After installation, restart your MCP client to reload the beads server.");
    }
}
export class BdClient {
    config;
    workspaceRoot;
    constructor(options = {}) {
        this.config = loadBeadsConfig();
        this.workspaceRoot = options.workspaceRoot ?? this.config.beadsWorkingDir;
    }
    getWorkingDir() {
        return this.workspaceRoot || this.config.beadsWorkingDir || process.cwd();
    }
    getGlobalFlags() {
        const flags = [];
        if (this.config.beadsActor) {
            flags.push("--actor", this.config.beadsActor);
        }
        if (this.config.beadsNoAutoFlush) {
            flags.push("--no-auto-flush");
        }
        if (this.config.beadsNoAutoImport) {
            flags.push("--no-auto-import");
        }
        return flags;
    }
    async runJsonCommand(args) {
        const fullArgs = [...args, ...this.getGlobalFlags(), "--json"];
        const cwd = this.getWorkingDir();
        const env = { ...process.env };
        if (this.config.beadsDir) {
            env.BEADS_DIR = this.config.beadsDir;
        }
        else if (this.config.beadsDb) {
            env.BEADS_DB = this.config.beadsDb;
        }
        return new Promise((resolve, reject) => {
            const child = spawn(this.config.beadsPath, fullArgs, {
                cwd,
                env,
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });
            child.on("error", (err) => {
                if (err.code === "ENOENT") {
                    reject(new BdNotFoundError(BdNotFoundError.installationMessage(this.config.beadsPath)));
                }
                else {
                    reject(err);
                }
            });
            child.on("close", (code) => {
                if (code && code !== 0) {
                    reject(new BdCommandError(`bd command failed: ${stderr}`, stderr, code));
                    return;
                }
                const trimmed = stdout.trim();
                if (!trimmed) {
                    resolve({});
                    return;
                }
                try {
                    const parsed = JSON.parse(trimmed);
                    resolve(parsed);
                }
                catch (error) {
                    reject(new BdCommandError(`Failed to parse bd JSON output: ${error.message}`, trimmed));
                }
            });
        });
    }
    async runTextCommand(args, useGlobalFlags = false) {
        const fullArgs = useGlobalFlags ? [...args, ...this.getGlobalFlags()] : args;
        const cwd = this.getWorkingDir();
        const env = { ...process.env };
        if (this.config.beadsDir) {
            env.BEADS_DIR = this.config.beadsDir;
        }
        else if (this.config.beadsDb) {
            env.BEADS_DB = this.config.beadsDb;
        }
        return new Promise((resolve, reject) => {
            const child = spawn(this.config.beadsPath, fullArgs, {
                cwd,
                env,
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });
            child.on("error", (err) => {
                if (err.code === "ENOENT") {
                    reject(new BdNotFoundError(BdNotFoundError.installationMessage(this.config.beadsPath)));
                }
                else {
                    reject(err);
                }
            });
            child.on("close", (code) => {
                if (code && code !== 0) {
                    reject(new BdCommandError(`bd command failed: ${stderr}`, stderr, code));
                    return;
                }
                resolve(stdout);
            });
        });
    }
    async ready(params = {}) {
        const args = ["ready", "--limit", String(params.limit ?? 10)];
        if (params.priority !== undefined) {
            args.push("--priority", String(params.priority));
        }
        if (params.assignee) {
            args.push("--assignee", params.assignee);
        }
        const data = await this.runJsonCommand(args);
        if (!Array.isArray(data)) {
            return [];
        }
        return data;
    }
    async listIssues(params = {}) {
        const args = ["list"];
        if (params.status) {
            args.push("--status", params.status);
        }
        if (params.priority !== undefined) {
            args.push("--priority", String(params.priority));
        }
        if (params.issue_type) {
            args.push("--type", params.issue_type);
        }
        if (params.assignee) {
            args.push("--assignee", params.assignee);
        }
        if (params.limit !== undefined) {
            args.push("--limit", String(params.limit));
        }
        const data = await this.runJsonCommand(args);
        if (!Array.isArray(data)) {
            return [];
        }
        return data;
    }
    async show(params) {
        const data = await this.runJsonCommand(["show", params.issue_id]);
        let obj = data;
        if (Array.isArray(data)) {
            if (data.length === 0) {
                throw new BdCommandError(`Issue not found: ${params.issue_id}`);
            }
            obj = data[0];
        }
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            throw new BdCommandError(`Invalid response for show ${params.issue_id}`);
        }
        return obj;
    }
    async create(params) {
        const args = [
            "create",
            params.title,
            "-p",
            String(params.priority ?? 2),
            "-t",
            params.issue_type ?? "task",
        ];
        if (params.description) {
            args.push("-d", params.description);
        }
        if (params.design) {
            args.push("--design", params.design);
        }
        if (params.acceptance) {
            args.push("--acceptance", params.acceptance);
        }
        if (params.external_ref) {
            args.push("--external-ref", params.external_ref);
        }
        if (params.assignee) {
            args.push("--assignee", params.assignee);
        }
        if (params.id) {
            args.push("--id", params.id);
        }
        if (params.labels) {
            for (const label of params.labels) {
                args.push("-l", label);
            }
        }
        if (params.deps && params.deps.length > 0) {
            args.push("--deps", params.deps.join(","));
        }
        const data = await this.runJsonCommand(args);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new BdCommandError("Invalid response for create");
        }
        return data;
    }
    async update(params) {
        const args = ["update", params.issue_id];
        if (params.status) {
            args.push("--status", params.status);
        }
        if (params.priority !== undefined) {
            args.push("--priority", String(params.priority));
        }
        if (params.assignee) {
            args.push("--assignee", params.assignee);
        }
        if (params.title) {
            args.push("--title", params.title);
        }
        if (params.description) {
            args.push("--description", params.description);
        }
        if (params.design) {
            args.push("--design", params.design);
        }
        if (params.acceptance_criteria) {
            args.push("--acceptance", params.acceptance_criteria);
        }
        if (params.notes) {
            args.push("--notes", params.notes);
        }
        if (params.external_ref) {
            args.push("--external-ref", params.external_ref);
        }
        const data = await this.runJsonCommand(args);
        let obj = data;
        if (Array.isArray(data)) {
            if (data.length === 0) {
                throw new BdCommandError(`Issue not found: ${params.issue_id}`);
            }
            obj = data[0];
        }
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            throw new BdCommandError(`Invalid response for update ${params.issue_id}`);
        }
        return obj;
    }
    async close(params) {
        const args = ["close", params.issue_id, "--reason", params.reason];
        const data = await this.runJsonCommand(args);
        if (!Array.isArray(data)) {
            throw new BdCommandError(`Invalid response for close ${params.issue_id}`);
        }
        return data;
    }
    async reopen(params) {
        const args = ["reopen", ...params.issue_ids];
        if (params.reason) {
            args.push("--reason", params.reason);
        }
        const data = await this.runJsonCommand(args);
        if (!Array.isArray(data)) {
            throw new BdCommandError(`Invalid response for reopen ${params.issue_ids.join(", ")}`);
        }
        return data;
    }
    async addDependency(params) {
        const args = [
            "dep",
            "add",
            params.issue_id,
            params.depends_on_id,
            "--type",
            params.dep_type,
            ...this.getGlobalFlags(),
        ];
        await this.runTextCommand(args);
    }
    async quickstart() {
        const output = await this.runTextCommand(["quickstart"]);
        return output;
    }
    async stats() {
        const data = await this.runJsonCommand(["stats"]);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new BdCommandError("Invalid response for stats");
        }
        return data;
    }
    async blocked() {
        const data = await this.runJsonCommand(["blocked"]);
        if (!Array.isArray(data)) {
            throw new BdCommandError("Invalid response for blocked");
        }
        return data;
    }
    async inspectMigration() {
        const data = await this.runJsonCommand(["inspect-migration"]);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new BdCommandError("Invalid response for inspect-migration");
        }
        return data;
    }
    async getSchemaInfo() {
        const data = await this.runJsonCommand(["get-schema-info"]);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new BdCommandError("Invalid response for get-schema-info");
        }
        return data;
    }
    async repairDeps(fix = false) {
        const args = ["repair-deps"];
        if (fix) {
            args.push("--fix");
        }
        const data = await this.runJsonCommand(args);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new BdCommandError("Invalid response for repair-deps");
        }
        return data;
    }
    async detectPollution(clean = false) {
        const args = ["detect-pollution"];
        if (clean) {
            args.push("--clean", "--yes");
        }
        const data = await this.runJsonCommand(args);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new BdCommandError("Invalid response for detect-pollution");
        }
        return data;
    }
    async validate(checks, fixAll = false) {
        const args = ["validate"];
        if (checks && checks.trim() !== "") {
            args.push("--checks", checks);
        }
        if (fixAll) {
            args.push("--fix-all");
        }
        const data = await this.runJsonCommand(args);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new BdCommandError("Invalid response for validate");
        }
        return data;
    }
    async init(params = {}) {
        const args = ["init"];
        if (params.prefix) {
            args.push("--prefix", params.prefix);
        }
        const output = await this.runTextCommand(args, true);
        return output;
    }
}

import { spawn } from "child_process";
import { loadBeadsConfig, BeadsConfig } from "./config.js";

export type IssueStatus = "open" | "in_progress" | "blocked" | "closed";
export type IssueType = "bug" | "feature" | "task" | "epic" | "chore";
export type DependencyType = "blocks" | "related" | "parent-child" | "discovered-from";

export interface IssueBase {
  id: string;
  title: string;
  description?: string;
  design?: string | null;
  acceptance_criteria?: string | null;
  notes?: string | null;
  external_ref?: string | null;
  status: IssueStatus;
  priority: number;
  issue_type: IssueType;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  assignee?: string | null;
  labels?: string[];
  dependency_count?: number;
  dependent_count?: number;
}

export interface LinkedIssue extends IssueBase {
  dependency_type?: DependencyType | null;
}

export interface Issue extends IssueBase {
  dependencies?: LinkedIssue[];
  dependents?: LinkedIssue[];
}

export interface BlockedIssue extends Issue {
  blocked_by_count: number;
  blocked_by: string[];
}

export interface Stats {
  total_issues: number;
  open_issues: number;
  in_progress_issues: number;
  closed_issues: number;
  blocked_issues: number;
  ready_issues: number;
  average_lead_time_hours: number;
}

export interface ReadyWorkParams {
  limit?: number;
  priority?: number;
  assignee?: string;
}

export interface ListIssuesParams {
  status?: IssueStatus;
  priority?: number;
  issue_type?: IssueType;
  assignee?: string;
  limit?: number;
}

export interface ShowIssueParams {
  issue_id: string;
}

export interface CreateIssueParams {
  title: string;
  description?: string;
  design?: string | null;
  acceptance?: string | null;
  external_ref?: string | null;
  priority?: number;
  issue_type?: IssueType;
  assignee?: string | null;
  labels?: string[];
  id?: string | null;
  deps?: string[];
}

export interface UpdateIssueParams {
  issue_id: string;
  status?: IssueStatus;
  priority?: number;
  assignee?: string;
  title?: string;
  description?: string;
  design?: string;
  acceptance_criteria?: string;
  notes?: string;
  external_ref?: string;
}

export interface CloseIssueParams {
  issue_id: string;
  reason: string;
}

export interface ReopenIssueParams {
  issue_ids: string[];
  reason?: string | null;
}

export interface AddDependencyParams {
  issue_id: string;
  depends_on_id: string;
  dep_type: DependencyType;
}

export interface InitParams {
  prefix?: string | null;
}

export class BdError extends Error {}

export class BdCommandError extends BdError {
  stderr: string;
  returncode: number;

  constructor(message: string, stderr: string = "", returncode: number = 1) {
    super(message);
    this.stderr = stderr;
    this.returncode = returncode;
  }
}

export class BdNotFoundError extends BdError {
  static installationMessage(attemptedPath: string): string {
    return (
      `bd CLI not found at: ${attemptedPath}\n\n` +
      "The beads MCP server requires the bd CLI to be installed separately.\n\n" +
      "Install bd CLI:\n" +
      "  curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/install.sh | bash\n\n" +
      "Or visit: https://github.com/steveyegge/beads#installation\n\n" +
      "After installation, restart your MCP client to reload the beads server."
    );
  }
}

export interface BdClientOptions {
  workspaceRoot?: string;
}

export class BdClient {
  private config: BeadsConfig;
  private workspaceRoot?: string;

  constructor(options: BdClientOptions = {}) {
    this.config = loadBeadsConfig();
    this.workspaceRoot = options.workspaceRoot ?? this.config.beadsWorkingDir;
  }

  private getWorkingDir(): string {
    return this.workspaceRoot || this.config.beadsWorkingDir || process.cwd();
  }

  private getGlobalFlags(): string[] {
    const flags: string[] = [];
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

  private async runJsonCommand(args: string[]): Promise<unknown> {
    const fullArgs = [...args, ...this.getGlobalFlags(), "--json"];
    const cwd = this.getWorkingDir();

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (this.config.beadsDir) {
      env.BEADS_DIR = this.config.beadsDir;
    } else if (this.config.beadsDb) {
      env.BEADS_DB = this.config.beadsDb;
    }

    return new Promise<unknown>((resolve, reject) => {
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

      child.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(new BdNotFoundError(BdNotFoundError.installationMessage(this.config.beadsPath)));
        } else {
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
          const parsed = JSON.parse(trimmed) as unknown;
          resolve(parsed);
        } catch (error) {
          reject(
            new BdCommandError(
              `Failed to parse bd JSON output: ${(error as Error).message}`,
              trimmed,
            ),
          );
        }
      });
    });
  }

  private async runTextCommand(args: string[], useGlobalFlags: boolean = false): Promise<string> {
    const fullArgs = useGlobalFlags ? [...args, ...this.getGlobalFlags()] : args;
    const cwd = this.getWorkingDir();

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (this.config.beadsDir) {
      env.BEADS_DIR = this.config.beadsDir;
    } else if (this.config.beadsDb) {
      env.BEADS_DB = this.config.beadsDb;
    }

    return new Promise<string>((resolve, reject) => {
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

      child.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          reject(new BdNotFoundError(BdNotFoundError.installationMessage(this.config.beadsPath)));
        } else {
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

  async ready(params: ReadyWorkParams = {}): Promise<Issue[]> {
    const args: string[] = ["ready", "--limit", String(params.limit ?? 10)];
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
    return data as Issue[];
  }

  async listIssues(params: ListIssuesParams = {}): Promise<Issue[]> {
    const args: string[] = ["list"];
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
    return data as Issue[];
  }

  async show(params: ShowIssueParams): Promise<Issue> {
    const data = await this.runJsonCommand(["show", params.issue_id]);
    let obj: unknown = data;

    if (Array.isArray(data)) {
      if (data.length === 0) {
        throw new BdCommandError(`Issue not found: ${params.issue_id}`);
      }
      obj = data[0];
    }

    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new BdCommandError(`Invalid response for show ${params.issue_id}`);
    }

    return obj as Issue;
  }

  async create(params: CreateIssueParams): Promise<Issue> {
    const args: string[] = [
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
    return data as Issue;
  }

  async update(params: UpdateIssueParams): Promise<Issue> {
    const args: string[] = ["update", params.issue_id];

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
    let obj: unknown = data;

    if (Array.isArray(data)) {
      if (data.length === 0) {
        throw new BdCommandError(`Issue not found: ${params.issue_id}`);
      }
      obj = data[0];
    }

    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new BdCommandError(`Invalid response for update ${params.issue_id}`);
    }

    return obj as Issue;
  }

  async close(params: CloseIssueParams): Promise<Issue[]> {
    const args: string[] = ["close", params.issue_id, "--reason", params.reason];
    const data = await this.runJsonCommand(args);
    if (!Array.isArray(data)) {
      throw new BdCommandError(`Invalid response for close ${params.issue_id}`);
    }
    return data as Issue[];
  }

  async reopen(params: ReopenIssueParams): Promise<Issue[]> {
    const args: string[] = ["reopen", ...params.issue_ids];
    if (params.reason) {
      args.push("--reason", params.reason);
    }

    const data = await this.runJsonCommand(args);
    if (!Array.isArray(data)) {
      throw new BdCommandError(`Invalid response for reopen ${params.issue_ids.join(", ")}`);
    }
    return data as Issue[];
  }

  async addDependency(params: AddDependencyParams): Promise<void> {
    const args: string[] = [
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

  async quickstart(): Promise<string> {
    const output = await this.runTextCommand(["quickstart"]);
    return output;
  }

  async stats(): Promise<Stats> {
    const data = await this.runJsonCommand(["stats"]);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new BdCommandError("Invalid response for stats");
    }
    return data as Stats;
  }

  async blocked(): Promise<BlockedIssue[]> {
    const data = await this.runJsonCommand(["blocked"]);
    if (!Array.isArray(data)) {
      throw new BdCommandError("Invalid response for blocked");
    }
    return data as BlockedIssue[];
  }

  async inspectMigration(): Promise<Record<string, unknown>> {
    const data = await this.runJsonCommand(["inspect-migration"]);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new BdCommandError("Invalid response for inspect-migration");
    }
    return data as Record<string, unknown>;
  }

  async getSchemaInfo(): Promise<Record<string, unknown>> {
    const data = await this.runJsonCommand(["get-schema-info"]);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new BdCommandError("Invalid response for get-schema-info");
    }
    return data as Record<string, unknown>;
  }

  async repairDeps(fix: boolean = false): Promise<Record<string, unknown>> {
    const args: string[] = ["repair-deps"];
    if (fix) {
      args.push("--fix");
    }
    const data = await this.runJsonCommand(args);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new BdCommandError("Invalid response for repair-deps");
    }
    return data as Record<string, unknown>;
  }

  async detectPollution(clean: boolean = false): Promise<Record<string, unknown>> {
    const args: string[] = ["detect-pollution"];
    if (clean) {
      args.push("--clean", "--yes");
    }
    const data = await this.runJsonCommand(args);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new BdCommandError("Invalid response for detect-pollution");
    }
    return data as Record<string, unknown>;
  }

  async validate(checks?: string | null, fixAll: boolean = false): Promise<Record<string, unknown>> {
    const args: string[] = ["validate"];
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
    return data as Record<string, unknown>;
  }

  async init(params: InitParams = {}): Promise<string> {
    const args: string[] = ["init"];
    if (params.prefix) {
      args.push("--prefix", params.prefix);
    }
    const output = await this.runTextCommand(args, true);
    return output;
  }
}


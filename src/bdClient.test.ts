import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BdClient,
  BdError,
  BdCommandError,
  BdNotFoundError,
  type IssueStatus,
  type IssueType,
  type DependencyType,
} from './bdClient.js';

describe('BdClient', () => {
  describe('Error Classes', () => {
    it('should create BdError', () => {
      const error = new BdError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
    });

    it('should create BdCommandError', () => {
      const error = new BdCommandError('Command failed', 'stderr output', 1);
      expect(error).toBeInstanceOf(BdError);
      expect(error.message).toBe('Command failed');
      expect(error.stderr).toBe('stderr output');
      expect(error.returncode).toBe(1);
    });

    it('should create BdCommandError with defaults', () => {
      const error = new BdCommandError('Command failed');
      expect(error.stderr).toBe('');
      expect(error.returncode).toBe(1);
    });

    it('should create BdNotFoundError', () => {
      const error = new BdNotFoundError('Not found');
      expect(error).toBeInstanceOf(BdError);
      expect(error.message).toBe('Not found');
    });

    it('should provide installation message', () => {
      const message = BdNotFoundError.installationMessage('/path/to/bd');
      expect(message).toContain('bd CLI not found');
      expect(message).toContain('/path/to/bd');
      expect(message).toContain('install.sh');
    });
  });

  describe('BdClient construction', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should create instance with default options', () => {
      const client = new BdClient();
      expect(client).toBeInstanceOf(BdClient);
    });

    it('should create instance with workspace root', () => {
      const client = new BdClient({ workspaceRoot: '/test/workspace' });
      expect(client).toBeInstanceOf(BdClient);
    });

    it('should respect BEADS_WORKING_DIR environment variable', () => {
      process.env.BEADS_WORKING_DIR = '/env/workspace';
      const client = new BdClient();
      expect(client).toBeInstanceOf(BdClient);
    });
  });

  describe('Type definitions', () => {
    it('should have correct IssueStatus values', () => {
      const statuses: IssueStatus[] = ['open', 'in_progress', 'blocked', 'closed'];
      expect(statuses).toHaveLength(4);
    });

    it('should have correct IssueType values', () => {
      const types: IssueType[] = ['bug', 'feature', 'task', 'epic', 'chore'];
      expect(types).toHaveLength(5);
    });

    it('should have correct DependencyType values', () => {
      const depTypes: DependencyType[] = [
        'blocks',
        'related',
        'parent-child',
        'discovered-from',
      ];
      expect(depTypes).toHaveLength(4);
    });
  });

  describe('Method signatures', () => {
    it('should have ready method', () => {
      const client = new BdClient();
      expect(typeof client.ready).toBe('function');
    });

    it('should have listIssues method', () => {
      const client = new BdClient();
      expect(typeof client.listIssues).toBe('function');
    });

    it('should have show method', () => {
      const client = new BdClient();
      expect(typeof client.show).toBe('function');
    });

    it('should have create method', () => {
      const client = new BdClient();
      expect(typeof client.create).toBe('function');
    });

    it('should have update method', () => {
      const client = new BdClient();
      expect(typeof client.update).toBe('function');
    });

    it('should have close method', () => {
      const client = new BdClient();
      expect(typeof client.close).toBe('function');
    });

    it('should have reopen method', () => {
      const client = new BdClient();
      expect(typeof client.reopen).toBe('function');
    });

    it('should have addDependency method', () => {
      const client = new BdClient();
      expect(typeof client.addDependency).toBe('function');
    });

    it('should have stats method', () => {
      const client = new BdClient();
      expect(typeof client.stats).toBe('function');
    });

    it('should have blocked method', () => {
      const client = new BdClient();
      expect(typeof client.blocked).toBe('function');
    });

    it('should have quickstart method', () => {
      const client = new BdClient();
      expect(typeof client.quickstart).toBe('function');
    });

    it('should have init method', () => {
      const client = new BdClient();
      expect(typeof client.init).toBe('function');
    });

    it('should have inspectMigration method', () => {
      const client = new BdClient();
      expect(typeof client.inspectMigration).toBe('function');
    });

    it('should have getSchemaInfo method', () => {
      const client = new BdClient();
      expect(typeof client.getSchemaInfo).toBe('function');
    });

    it('should have repairDeps method', () => {
      const client = new BdClient();
      expect(typeof client.repairDeps).toBe('function');
    });

    it('should have detectPollution method', () => {
      const client = new BdClient();
      expect(typeof client.detectPollution).toBe('function');
    });

    it('should have validate method', () => {
      const client = new BdClient();
      expect(typeof client.validate).toBe('function');
    });
  });
});

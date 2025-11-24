import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultBeadsPath, loadBeadsConfig } from './config.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('defaultBeadsPath', () => {
    it('should return BEADS_PATH from environment if set', () => {
      process.env.BEADS_PATH = '/custom/path/to/bd';
      expect(defaultBeadsPath()).toBe('/custom/path/to/bd');
    });

    it('should return fallback path when BEADS_PATH not set', () => {
      delete process.env.BEADS_PATH;
      delete process.env.PATH;
      const result = defaultBeadsPath();
      expect(result).toBe(path.join(os.homedir(), '.local', 'bin', 'bd'));
    });

    it('should ignore empty BEADS_PATH', () => {
      process.env.BEADS_PATH = '  ';
      const result = defaultBeadsPath();
      expect(result).toBe(path.join(os.homedir(), '.local', 'bin', 'bd'));
    });
  });

  describe('loadBeadsConfig', () => {
    it('should load default config with no environment variables', () => {
      delete process.env.BEADS_PATH;
      delete process.env.BEADS_DIR;
      delete process.env.BEADS_DB;
      delete process.env.BEADS_ACTOR;
      delete process.env.BEADS_NO_AUTO_FLUSH;
      delete process.env.BEADS_NO_AUTO_IMPORT;
      delete process.env.BEADS_WORKING_DIR;

      const config = loadBeadsConfig();
      expect(config.beadsDir).toBeUndefined();
      expect(config.beadsDb).toBeUndefined();
      expect(config.beadsNoAutoFlush).toBe(false);
      expect(config.beadsNoAutoImport).toBe(false);
      expect(config.beadsWorkingDir).toBeUndefined();
    });

    it('should load BEADS_DIR from environment', () => {
      process.env.BEADS_DIR = '/test/beads/dir';
      const config = loadBeadsConfig();
      expect(config.beadsDir).toBe('/test/beads/dir');
    });

    it('should load BEADS_DB from environment', () => {
      process.env.BEADS_DB = '/test/beads/db.db';
      const config = loadBeadsConfig();
      expect(config.beadsDb).toBe('/test/beads/db.db');
    });

    it('should load BEADS_ACTOR from environment', () => {
      process.env.BEADS_ACTOR = 'test-actor';
      const config = loadBeadsConfig();
      expect(config.beadsActor).toBe('test-actor');
    });

    it('should use USER as fallback for BEADS_ACTOR', () => {
      delete process.env.BEADS_ACTOR;
      process.env.USER = 'test-user';
      const config = loadBeadsConfig();
      expect(config.beadsActor).toBe('test-user');
    });

    it('should load BEADS_WORKING_DIR from environment', () => {
      process.env.BEADS_WORKING_DIR = '/test/working/dir';
      const config = loadBeadsConfig();
      expect(config.beadsWorkingDir).toBe('/test/working/dir');
    });

    it('should parse BEADS_NO_AUTO_FLUSH as true for "1"', () => {
      process.env.BEADS_NO_AUTO_FLUSH = '1';
      const config = loadBeadsConfig();
      expect(config.beadsNoAutoFlush).toBe(true);
    });

    it('should parse BEADS_NO_AUTO_FLUSH as true for "true"', () => {
      process.env.BEADS_NO_AUTO_FLUSH = 'true';
      const config = loadBeadsConfig();
      expect(config.beadsNoAutoFlush).toBe(true);
    });

    it('should parse BEADS_NO_AUTO_FLUSH as true for "yes"', () => {
      process.env.BEADS_NO_AUTO_FLUSH = 'yes';
      const config = loadBeadsConfig();
      expect(config.beadsNoAutoFlush).toBe(true);
    });

    it('should parse BEADS_NO_AUTO_FLUSH as false for other values', () => {
      process.env.BEADS_NO_AUTO_FLUSH = 'false';
      const config = loadBeadsConfig();
      expect(config.beadsNoAutoFlush).toBe(false);
    });

    it('should parse BEADS_NO_AUTO_IMPORT as true for "1"', () => {
      process.env.BEADS_NO_AUTO_IMPORT = '1';
      const config = loadBeadsConfig();
      expect(config.beadsNoAutoImport).toBe(true);
    });

    it('should parse BEADS_NO_AUTO_IMPORT as false for undefined', () => {
      delete process.env.BEADS_NO_AUTO_IMPORT;
      const config = loadBeadsConfig();
      expect(config.beadsNoAutoImport).toBe(false);
    });
  });
});

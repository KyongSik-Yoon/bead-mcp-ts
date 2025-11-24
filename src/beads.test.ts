import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BeadsManager } from './beads.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('BeadsManager', () => {
  let tempDir: string;
  let manager: BeadsManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beads-test-'));
    manager = new BeadsManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('init', () => {
    it('should create .beads directory', () => {
      const result = manager.init();
      expect(result).toBe('Initialized .beads directory.');
      expect(fs.existsSync(path.join(tempDir, '.beads'))).toBe(true);
    });

    it('should create beads.jsonl file', () => {
      manager.init();
      const beadsFile = path.join(tempDir, '.beads', 'beads.jsonl');
      expect(fs.existsSync(beadsFile)).toBe(true);
    });

    it('should not fail if called multiple times', () => {
      manager.init();
      const result = manager.init();
      expect(result).toBe('Initialized .beads directory.');
    });
  });

  describe('add', () => {
    it('should add a new bead with default priority', () => {
      manager.init();
      const bead = manager.add('Test Title', 'Test Description');
      
      expect(bead.title).toBe('Test Title');
      expect(bead.description).toBe('Test Description');
      expect(bead.status).toBe('open');
      expect(bead.priority).toBe(1);
      expect(bead.id).toBeDefined();
      expect(bead.created_at).toBeDefined();
      expect(bead.updated_at).toBeDefined();
    });

    it('should add a bead with custom priority', () => {
      manager.init();
      const bead = manager.add('Test Title', 'Test Description', 3);
      expect(bead.priority).toBe(3);
    });

    it('should throw error if not initialized', () => {
      expect(() => manager.add('Title', 'Description')).toThrow('Beads not initialized');
    });

    it('should persist beads to file', () => {
      manager.init();
      manager.add('First', 'First Description');
      manager.add('Second', 'Second Description');

      const beads = manager.getAll();
      expect(beads).toHaveLength(2);
      expect(beads[0].title).toBe('First');
      expect(beads[1].title).toBe('Second');
    });
  });

  describe('getAll', () => {
    it('should return empty array if no beads', () => {
      manager.init();
      const beads = manager.getAll();
      expect(beads).toEqual([]);
    });

    it('should return all beads', () => {
      manager.init();
      manager.add('First', 'First Description');
      manager.add('Second', 'Second Description');

      const beads = manager.getAll();
      expect(beads).toHaveLength(2);
    });

    it('should throw error if not initialized', () => {
      expect(() => manager.getAll()).toThrow('Beads not initialized');
    });
  });

  describe('update', () => {
    it('should update a bead', () => {
      manager.init();
      const bead = manager.add('Original Title', 'Original Description');
      
      const updated = manager.update(bead.id, {
        title: 'Updated Title',
        status: 'in_progress',
        priority: 2,
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.status).toBe('in_progress');
      expect(updated?.priority).toBe(2);
      expect(updated?.description).toBe('Original Description');
    });

    it('should update the updated_at timestamp', async () => {
      manager.init();
      const bead = manager.add('Title', 'Description');
      const originalUpdatedAt = bead.updated_at;

      // Wait a tiny bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = manager.update(bead.id, { title: 'New Title' });
      expect(updated?.updated_at).not.toBe(originalUpdatedAt);
    });

    it('should return null for non-existent bead', () => {
      manager.init();
      const updated = manager.update('non-existent-id', { title: 'New Title' });
      expect(updated).toBeNull();
    });

    it('should throw error if not initialized', () => {
      expect(() => manager.update('id', { title: 'Title' })).toThrow('Beads not initialized');
    });

    it('should persist updates to file', () => {
      manager.init();
      const bead = manager.add('Original', 'Description');
      manager.update(bead.id, { title: 'Updated' });

      const beads = manager.getAll();
      expect(beads[0].title).toBe('Updated');
    });
  });
});

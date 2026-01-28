import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { AttachmentService } from '../services/attachment-service.js';
import type { Attachment } from '@veritas-kanban/shared';

// Use temp directories for tests
const TEST_ROOT = path.join(process.cwd(), '..', '.test-attachments');
const ATTACHMENTS_DIR = path.join(TEST_ROOT, 'attachments');
const ARCHIVE_DIR = path.join(TEST_ROOT, 'archive-attachments');

describe('AttachmentService', () => {
  let service: AttachmentService;
  const testTaskId = 'task_test_123';

  beforeEach(async () => {
    // Create fresh test directories
    await fs.mkdir(ATTACHMENTS_DIR, { recursive: true });
    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    service = new AttachmentService({
      attachmentsDir: ATTACHMENTS_DIR,
      archiveAttachmentsDir: ARCHIVE_DIR,
    });
  });

  afterEach(async () => {
    // Clean up test directories
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  });

  describe('File upload', () => {
    it('should save an attachment and return metadata', async () => {
      const mockFile = {
        originalname: 'test-file.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('Test content'),
      } as Express.Multer.File;

      const attachment = await service.saveAttachment(testTaskId, mockFile);

      expect(attachment).toMatchObject({
        originalName: 'test-file.txt',
        mimeType: 'text/plain',
        size: 1024,
      });
      expect(attachment.id).toMatch(/^att_\d+_[a-zA-Z0-9]{6}$/);
      expect(attachment.filename).toContain(attachment.id);
      expect(attachment.uploaded).toBeDefined();

      // Verify file exists
      const filepath = service.getAttachmentPath(testTaskId, attachment.filename);
      const content = await fs.readFile(filepath, 'utf-8');
      expect(content).toBe('Test content');
    });

    it('should sanitize filenames with special characters', async () => {
      const mockFile = {
        originalname: '../../../etc/passwd',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Test'),
      } as Express.Multer.File;

      const attachment = await service.saveAttachment(testTaskId, mockFile);

      expect(attachment.filename).not.toContain('/');
      expect(attachment.filename).not.toContain('..');
    });

    it('should reject files that exceed size limit', async () => {
      const limits = service.getLimits();
      const mockFile = {
        originalname: 'large-file.txt',
        mimetype: 'text/plain',
        size: limits.maxFileSize + 1,
        buffer: Buffer.alloc(limits.maxFileSize + 1),
      } as Express.Multer.File;

      await expect(service.saveAttachment(testTaskId, mockFile)).rejects.toThrow(
        /exceeds maximum allowed size/
      );
    });

    it('should reject disallowed MIME types', async () => {
      const mockFile = {
        originalname: 'script.exe',
        mimetype: 'application/x-executable',
        size: 1024,
        buffer: Buffer.from('Test'),
      } as Express.Multer.File;

      await expect(service.saveAttachment(testTaskId, mockFile)).rejects.toThrow(
        /File type.*is not allowed/
      );
    });

    it('should reject when max files per task is reached', async () => {
      const limits = service.getLimits();
      const existingAttachments: Attachment[] = Array.from({ length: limits.maxFilesPerTask }).map(
        (_, i) => ({
          id: `att_${i}`,
          filename: `file_${i}.txt`,
          originalName: `file_${i}.txt`,
          mimeType: 'text/plain',
          size: 100,
          uploaded: new Date().toISOString(),
        })
      );

      const mockFile = {
        originalname: 'one-too-many.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Test'),
      } as Express.Multer.File;

      await expect(service.saveAttachment(testTaskId, mockFile, existingAttachments)).rejects.toThrow(
        /Maximum number of attachments.*already reached/
      );
    });
  });

  describe('Extracted text management', () => {
    it('should save and retrieve extracted text', async () => {
      const attachmentId = 'att_test_123';
      const text = 'This is extracted text from a document.';

      await service.saveExtractedText(testTaskId, attachmentId, text);

      const retrieved = await service.getExtractedText(testTaskId, attachmentId);
      expect(retrieved).toBe(text);
    });

    it('should return null for non-existent extracted text', async () => {
      const text = await service.getExtractedText(testTaskId, 'nonexistent');
      expect(text).toBeNull();
    });
  });

  describe('Attachment deletion', () => {
    it('should delete attachment file and extracted text', async () => {
      // Create attachment
      const mockFile = {
        originalname: 'delete-me.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Test'),
      } as Express.Multer.File;

      const attachment = await service.saveAttachment(testTaskId, mockFile);
      await service.saveExtractedText(testTaskId, attachment.id, 'Extracted text');

      // Verify files exist
      const filepath = service.getAttachmentPath(testTaskId, attachment.filename);
      await expect(fs.access(filepath)).resolves.toBeUndefined();

      // Delete attachment
      await service.deleteAttachment(testTaskId, attachment);

      // Verify files are gone
      await expect(fs.access(filepath)).rejects.toThrow();
      const text = await service.getExtractedText(testTaskId, attachment.id);
      expect(text).toBeNull();
    });
  });

  describe('Archive management', () => {
    it('should move attachments to archive', async () => {
      // Create attachment
      const mockFile = {
        originalname: 'archive-me.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Test'),
      } as Express.Multer.File;

      const attachment = await service.saveAttachment(testTaskId, mockFile);
      const originalPath = service.getAttachmentPath(testTaskId, attachment.filename);

      // Verify file exists in active
      await expect(fs.access(originalPath)).resolves.toBeUndefined();

      // Archive
      await service.archiveAttachments(testTaskId);

      // Verify moved
      await expect(fs.access(originalPath)).rejects.toThrow();
      const archivePath = path.join(ARCHIVE_DIR, testTaskId, attachment.filename);
      await expect(fs.access(archivePath)).resolves.toBeUndefined();
    });

    it('should restore attachments from archive', async () => {
      // Create and archive
      const mockFile = {
        originalname: 'restore-me.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Test'),
      } as Express.Multer.File;

      const attachment = await service.saveAttachment(testTaskId, mockFile);
      await service.archiveAttachments(testTaskId);

      // Restore
      await service.restoreAttachments(testTaskId);

      // Verify restored
      const activePath = service.getAttachmentPath(testTaskId, attachment.filename);
      await expect(fs.access(activePath)).resolves.toBeUndefined();
      const archivePath = path.join(ARCHIVE_DIR, testTaskId, attachment.filename);
      await expect(fs.access(archivePath)).rejects.toThrow();
    });
  });

  describe('Directory cleanup', () => {
    it('should cleanup empty directories after deleting all attachments', async () => {
      // Create attachment
      const mockFile = {
        originalname: 'cleanup-test.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Test'),
      } as Express.Multer.File;

      const attachment = await service.saveAttachment(testTaskId, mockFile);
      await service.saveExtractedText(testTaskId, attachment.id, 'Text');

      const taskDir = path.join(ATTACHMENTS_DIR, testTaskId);
      await expect(fs.access(taskDir)).resolves.toBeUndefined();

      // Delete all attachments
      await service.deleteAllAttachments(testTaskId);

      // Verify directory is gone
      await expect(fs.access(taskDir)).rejects.toThrow();
    });
  });

  describe('File listing', () => {
    it('should list files excluding .extracted directory', async () => {
      const mockFile1 = {
        originalname: 'file1.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Test 1'),
      } as Express.Multer.File;

      const mockFile2 = {
        originalname: 'file2.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from('Test 2'),
      } as Express.Multer.File;

      await service.saveAttachment(testTaskId, mockFile1);
      await service.saveAttachment(testTaskId, mockFile2);

      const files = await service.listFiles(testTaskId);
      expect(files).toHaveLength(2);
      expect(files.every(f => f !== '.extracted')).toBe(true);
    });

    it('should return empty array for non-existent task', async () => {
      const files = await service.listFiles('nonexistent-task');
      expect(files).toEqual([]);
    });
  });
});

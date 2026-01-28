import fs from 'fs/promises';
import path from 'path';
import { extractText as unpdfExtract } from 'unpdf';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export interface TextExtractionResult {
  text: string | null;
  error?: string;
}

export class TextExtractionService {
  /**
   * Extract text from a file based on its MIME type
   */
  async extractText(filepath: string, mimeType: string): Promise<string | null> {
    try {
      // Plain text files
      if (mimeType.startsWith('text/plain') || mimeType === 'text/markdown') {
        return await this.extractPlainText(filepath);
      }

      // PDF
      if (mimeType === 'application/pdf') {
        return await this.extractPDF(filepath);
      }

      // DOCX
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.extractDOCX(filepath);
      }

      // DOC (old format) - mammoth can handle it
      if (mimeType === 'application/msword') {
        return await this.extractDOCX(filepath);
      }

      // Excel files
      if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel'
      ) {
        return await this.extractXLSX(filepath);
      }

      // CSV
      if (mimeType === 'text/csv') {
        return await this.extractPlainText(filepath);
      }

      // HTML
      if (mimeType === 'text/html') {
        return await this.extractHTML(filepath);
      }

      // JSON
      if (mimeType === 'application/json') {
        return await this.extractJSON(filepath);
      }

      // XML/YAML
      if (mimeType === 'application/xml' || mimeType === 'text/xml' || 
          mimeType === 'application/yaml' || mimeType === 'text/yaml') {
        return await this.extractPlainText(filepath);
      }

      // Images - return null (agents will use vision APIs)
      if (mimeType.startsWith('image/')) {
        return null;
      }

      // Unknown type
      return null;
    } catch (error) {
      console.error(`Text extraction failed for ${filepath}:`, error);
      return null;
    }
  }

  /**
   * Extract plain text
   */
  private async extractPlainText(filepath: string): Promise<string> {
    const buffer = await fs.readFile(filepath);
    return buffer.toString('utf-8');
  }

  /**
   * Extract text from PDF using unpdf
   */
  private async extractPDF(filepath: string): Promise<string | null> {
    try {
      const buffer = await fs.readFile(filepath);
      const { text } = await unpdfExtract(buffer, { mergePages: true });
      return text || null;
    } catch (error) {
      console.error('PDF extraction error:', error);
      return null;
    }
  }

  /**
   * Extract text from DOCX using mammoth
   */
  private async extractDOCX(filepath: string): Promise<string | null> {
    try {
      const buffer = await fs.readFile(filepath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value || null;
    } catch (error) {
      console.error('DOCX extraction error:', error);
      return null;
    }
  }

  /**
   * Extract text from Excel files (convert to CSV-like format)
   */
  private async extractXLSX(filepath: string): Promise<string | null> {
    try {
      const buffer = await fs.readFile(filepath);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Extract all sheets
      const sheets: string[] = [];
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        
        if (csv.trim()) {
          sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
        }
      }
      
      return sheets.length > 0 ? sheets.join('\n\n') : null;
    } catch (error) {
      console.error('XLSX extraction error:', error);
      return null;
    }
  }

  /**
   * Extract text from HTML (strip tags)
   */
  private async extractHTML(filepath: string): Promise<string | null> {
    try {
      const html = await fs.readFile(filepath, 'utf-8');
      
      // Simple tag stripping (for more complex HTML, consider using a library like cheerio)
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return text || null;
    } catch (error) {
      console.error('HTML extraction error:', error);
      return null;
    }
  }

  /**
   * Extract text from JSON (pretty print)
   */
  private async extractJSON(filepath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const json = JSON.parse(content);
      return JSON.stringify(json, null, 2);
    } catch (error) {
      console.error('JSON extraction error:', error);
      return null;
    }
  }
}

// Singleton instance
let textExtractionServiceInstance: TextExtractionService | null = null;

export function getTextExtractionService(): TextExtractionService {
  if (!textExtractionServiceInstance) {
    textExtractionServiceInstance = new TextExtractionService();
  }
  return textExtractionServiceInstance;
}

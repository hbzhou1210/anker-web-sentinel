import { query } from '../../database/connection.js';
import { FeishuDocument, FeishuDocumentRow } from '../entities.js';

export class FeishuDocumentRepository {
  // Convert database row to entity
  private static rowToEntity(row: FeishuDocumentRow): FeishuDocument {
    return {
      id: row.id,
      documentId: row.document_id,
      documentUrl: row.document_url,
      title: row.title ?? undefined,
      content: row.content ?? undefined,
      importedAt: row.imported_at,
      lastSyncedAt: row.last_synced_at ?? undefined,
      metadata: row.metadata ?? undefined,
    };
  }

  // Create a new document record
  static async create(document: Omit<FeishuDocument, 'id' | 'importedAt'>): Promise<FeishuDocument> {
    const result = await query<FeishuDocumentRow>(
      `INSERT INTO feishu_documents
       (document_id, document_url, title, content, last_synced_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (document_id)
       DO UPDATE SET
         document_url = EXCLUDED.document_url,
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         last_synced_at = EXCLUDED.last_synced_at,
         metadata = EXCLUDED.metadata
       RETURNING *`,
      [
        document.documentId,
        document.documentUrl,
        document.title ?? null,
        document.content ?? null,
        document.lastSyncedAt ?? new Date(),
        document.metadata ? JSON.stringify(document.metadata) : null,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create feishu document');
    }

    return this.rowToEntity(result.rows[0]);
  }

  // Find document by document ID
  static async findByDocumentId(documentId: string): Promise<FeishuDocument | null> {
    const result = await query<FeishuDocumentRow>(
      'SELECT * FROM feishu_documents WHERE document_id = $1',
      [documentId]
    );

    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  // Find document by UUID
  static async findById(id: string): Promise<FeishuDocument | null> {
    const result = await query<FeishuDocumentRow>(
      'SELECT * FROM feishu_documents WHERE id = $1',
      [id]
    );

    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  // List all documents
  static async findAll(limit = 50, offset = 0): Promise<FeishuDocument[]> {
    const result = await query<FeishuDocumentRow>(
      'SELECT * FROM feishu_documents ORDER BY imported_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return result.rows.map(this.rowToEntity);
  }

  // Update document
  static async update(
    id: string,
    updates: Partial<Omit<FeishuDocument, 'id' | 'documentId' | 'importedAt'>>
  ): Promise<FeishuDocument | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push(`content = $${paramCount++}`);
      values.push(updates.content);
    }
    if (updates.lastSyncedAt !== undefined) {
      fields.push(`last_synced_at = $${paramCount++}`);
      values.push(updates.lastSyncedAt);
    }
    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query<FeishuDocumentRow>(
      `UPDATE feishu_documents SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  // Delete document
  static async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM feishu_documents WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}

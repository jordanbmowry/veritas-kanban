import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Attachment } from '@veritas-kanban/shared';

const API_BASE = 'http://localhost:3001/api';

interface UploadResponse {
  success: boolean;
  attachments: Attachment[];
  task: unknown;
}

interface TaskContext {
  taskId: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  project?: string;
  tags?: string[];
  attachments: {
    count: number;
    documents: { filename: string; text: string }[];
    images: string[];
  };
  created: string;
  updated: string;
}

/**
 * Fetch attachments for a task
 */
export function useAttachments(taskId: string) {
  return useQuery<Attachment[]>({
    queryKey: ['attachments', taskId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments`);
      if (!response.ok) {
        throw new Error('Failed to fetch attachments');
      }
      return response.json();
    },
    enabled: !!taskId,
  });
}

/**
 * Upload attachment(s) to a task
 */
export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, formData }: { taskId: string; formData: FormData }) => {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload attachment');
      }

      return response.json() as Promise<UploadResponse>;
    },
    onSuccess: (_, { taskId }) => {
      // Invalidate both attachments and task queries
      queryClient.invalidateQueries({ queryKey: ['attachments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Delete an attachment
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, attachmentId }: { taskId: string; attachmentId: string }) => {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete attachment');
      }

      return response.json();
    },
    onSuccess: (_, { taskId }) => {
      // Invalidate both attachments and task queries
      queryClient.invalidateQueries({ queryKey: ['attachments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Fetch full task context for agent consumption
 */
export function useTaskContext(taskId: string) {
  return useQuery<TaskContext>({
    queryKey: ['task-context', taskId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/context`);
      if (!response.ok) {
        throw new Error('Failed to fetch task context');
      }
      return response.json();
    },
    enabled: !!taskId,
  });
}

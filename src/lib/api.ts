import type {
  Comment,
  CommentStance,
  HighlightColor,
  MarginAnnotation,
  Post,
  PostRevision,
  PostStatus,
  User,
} from '../types';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  auth: {
    me: () => request<{ user: User | null }>('/api/auth/me'),
    login: (payload: { email: string; password: string }) =>
      request<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    register: (payload: {
      name: string;
      username?: string;
      email: string;
      password: string;
      bio?: string;
    }) =>
      request<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    logout: () =>
      request<{ ok: boolean }>('/api/auth/logout', {
        method: 'POST',
      }),
  },

  posts: {
    list: (params?: {
      category?: string;
      q?: string;
      status?: 'published' | 'draft' | 'all';
      author?: string;
      sort?: 'latest' | 'popular' | 'discussed';
    }) => {
      const search = new URLSearchParams();
      if (params?.category && params.category !== 'All') search.set('category', params.category);
      if (params?.q) search.set('q', params.q);
      if (params?.status) search.set('status', params.status);
      if (params?.author) search.set('author', params.author);
      if (params?.sort) search.set('sort', params.sort);
      const qs = search.toString();
      return request<{ posts: Post[] }>(`/api/posts${qs ? `?${qs}` : ''}`);
    },
    get: (idOrSlug: string | number) =>
      request<{ post: Post; sparksByParagraph: Record<number, number> }>(`/api/posts/${idOrSlug}`),
    create: (payload: {
      title: string;
      subtitle?: string;
      excerpt?: string;
      content: string;
      cover_image?: string;
      category?: string;
      status?: PostStatus;
    }) =>
      request<{ post: Post }>('/api/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (
      id: number,
      payload: {
        title: string;
        subtitle?: string;
        excerpt?: string;
        content: string;
        cover_image?: string;
        category?: string;
        status?: PostStatus;
        change_summary?: string;
      }
    ) =>
      request<{ post: Post }>(`/api/posts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id: number) =>
      request<{ ok: boolean; deletedId: number }>(`/api/posts/${id}`, {
        method: 'DELETE',
      }),
    revisions: (id: number) =>
      request<{ revisions: PostRevision[] }>(`/api/posts/${id}/revisions`),
    spark: (
      id: number,
      paragraph_index: number,
      reaction_type: 'resonant' | 'insightful' | 'bookmark' = 'resonant'
    ) =>
      request<{ sparksByParagraph: Record<number, number> }>(`/api/posts/${id}/sparks`, {
        method: 'POST',
        body: JSON.stringify({ paragraph_index, reaction_type }),
      }),
  },

  comments: {
    list: (postId: number) => request<{ comments: Comment[] }>(`/api/posts/${postId}/comments`),
    create: (
      postId: number,
      payload: { content: string; parent_id?: number | null; stance?: CommentStance }
    ) =>
      request<{ comment: Comment }>(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    upvote: (commentId: number) =>
      request<{ upvotes: number; upvoted: boolean }>(`/api/comments/${commentId}/upvote`, {
        method: 'POST',
      }),
    delete: (commentId: number) =>
      request<{ ok: boolean; deletedId: number }>(`/api/comments/${commentId}`, {
        method: 'DELETE',
      }),
  },

  annotations: {
    recent: () => request<{ annotations: MarginAnnotation[] }>('/api/annotations/recent'),
    list: (postId: number) =>
      request<{ annotations: MarginAnnotation[] }>(`/api/posts/${postId}/annotations`),
    create: (
      postId: number,
      payload: {
        paragraph_index: number;
        selected_quote?: string;
        note: string;
        highlight_color?: HighlightColor;
      }
    ) =>
      request<{ annotation: MarginAnnotation }>(`/api/posts/${postId}/annotations`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    delete: (annotationId: number) =>
      request<{ ok: boolean; deletedId: number }>(`/api/annotations/${annotationId}`, {
        method: 'DELETE',
      }),
  },
};

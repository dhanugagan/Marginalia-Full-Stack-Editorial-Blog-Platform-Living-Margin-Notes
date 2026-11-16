export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  bio: string;
  avatar_url: string;
  role: string;
  created_at: string;
}

export type PostStatus = 'published' | 'draft';

export interface Post {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  content: string;
  cover_image: string;
  category: string;
  reading_time_min: number;
  status: PostStatus;
  author_id: number;
  views_count: number;
  created_at: string;
  updated_at: string;
  author_name: string;
  author_username: string;
  author_bio?: string;
  author_avatar?: string;
  comment_count?: number;
  annotation_count?: number;
  revision_count?: number;
  spark_count?: number;
}

export interface PostRevision {
  id: number;
  post_id: number;
  version_num: number;
  title: string;
  content: string;
  change_summary: string;
  editor_id: number;
  editor_name: string;
  editor_username: string;
  created_at: string;
}

export type CommentStance = 'insight' | 'question' | 'counterpoint' | 'note';

export interface Comment {
  id: number;
  post_id: number;
  author_id: number;
  parent_id: number | null;
  stance: CommentStance;
  content: string;
  upvotes: number;
  user_upvoted: number | boolean;
  created_at: string;
  updated_at: string;
  author_name: string;
  author_username: string;
  author_avatar?: string;
}

export type HighlightColor = 'lapis' | 'amber' | 'forest';

export interface MarginAnnotation {
  id: number;
  post_id: number;
  paragraph_index: number;
  selected_quote: string;
  note: string;
  highlight_color: HighlightColor;
  author_id: number;
  author_name: string;
  author_username: string;
  created_at: string;
  post_title?: string;
  post_slug?: string;
  post_category?: string;
}

export const EDITORIAL_CATEGORIES = [
  'All',
  'Design',
  'Essays',
  'Architecture',
  'Engineering',
  'Culture',
] as const;

export const COVER_PRESETS = [
  {
    label: 'Brutalist Courtyard Daylight',
    url: '/src/assets/images/lead_architecture_light_1794846803963.jpg',
  },
  {
    label: 'Open Monograph & Margin Notes',
    url: '/src/assets/images/feature_margin_notes_1794846804409.jpg',
  },
  {
    label: 'Dawn Transit Atrium',
    url: '/src/assets/images/feature_urban_acoustics_1794846804284.jpg',
  },
  {
    label: 'Knurled Aluminum Studio Controls',
    url: '/src/assets/images/feature_tactile_hardware_1794846804779.jpg',
  },
];

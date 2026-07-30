export type Article = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ArticleInput = Omit<Article, 'id' | 'created_at' | 'updated_at'> & {
  id?: number;
};

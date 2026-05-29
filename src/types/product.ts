export type Product = {
  id: number;
  slug: string;
  name: string;
  category: string;
  headline: string | null;
  description: string;
  story: string | null;
  industries: string[];
  benefits: string[];
  presentations: string[];
  tags: string[];
  dilution: string | null;
  ph: string | null;
  image_url: string | null;
  featured: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'> & {
  id?: number;
};

export type QuoteStatus = 'new' | 'contacted' | 'closed';

export type QuoteProductDetail = {
  slug: string;
  presentation: string;
  quantity: number;
};

export type QuoteRequest = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  industry: string | null;
  message: string | null;
  product_slugs: string[];
  product_details: QuoteProductDetail[] | null;
  status: QuoteStatus;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteRequestInput = Pick<
  QuoteRequest,
  'name' | 'email' | 'phone' | 'company' | 'industry' | 'message' | 'product_slugs'
> & {
  product_details?: QuoteProductDetail[];
};

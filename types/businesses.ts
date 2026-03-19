export interface BusinessRecord {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessPayload {
  name: string;
  slug: string;
}

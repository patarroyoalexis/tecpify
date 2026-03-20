export interface BusinessRecord {
  id: string;
  slug: string;
  name: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessPayload {
  name: string;
  slug: string;
}

export interface BusinessRecord {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string | null;
}

export interface CreateBusinessPayload {
  name: string;
  slug: string;
}

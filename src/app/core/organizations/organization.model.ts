export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
  description?: string;
}

export interface CreateOrganizationInput {
  name: string;
  description?: string;
  avatar?: File;
}

export interface CreateOrganizationResult {
  organization: Organization;
  avatarUploadFailed: boolean;
}

/** Profile and organization settings, using the existing user/organization endpoints. */
import { apiFetch, type Me, type Organization } from "./api";

export function updateMe(id: string, input: { name?: string; mobile_number?: string }): Promise<Me> {
  return apiFetch(`/user/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function getOrganization(id: string): Promise<Organization> {
  return apiFetch(`/organization/${id}`);
}

export type OrganizationSettingsInput = Partial<
  Pick<Organization, "name" | "industry" | "country" | "headquarters_address" | "gst_number" | "website" | "operating_cities">
>;

export function updateOrganization(id: string, input: OrganizationSettingsInput): Promise<Organization> {
  return apiFetch(`/organization/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

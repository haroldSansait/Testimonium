import type { IProfileProvider } from "../types";
import type { UserProfile } from "../../types";
import { client } from "../../api/client";

const mapProfile = (data: any): UserProfile => {
  if (!data) return data;
  return {
    uid: data.firebaseUid || String(data.id),
    email: data.email,
    emailVerified: data.isVerified || false,
    role: data.role,
    displayName: data.fullName || "",
    phone: data.contactNumber || "",
    address: data.address || "",
    notificationsEnabled: true,
    parishId: data.parish?.id ? String(data.parish.id) : undefined,
  };
};

export class ApiProfileProvider implements IProfileProvider {
  async getProfile(_uid: string): Promise<UserProfile | null> {
    const response = await client.get<any>("/auth/profile");
    const data = response?.data !== undefined ? response.data : response;
    return mapProfile(data);
  }

  async updateProfile(_uid: string, profile: Partial<UserProfile>): Promise<void> {
    const payload: Record<string, unknown> = {
      fullName: profile.displayName,
      contactNumber: profile.phone,
    };
    // Include address only when it was explicitly provided in the update payload
    if (profile.address !== undefined) {
      payload.address = profile.address;
    }
    await client.put<any>("/auth/profile", payload);
  }
}

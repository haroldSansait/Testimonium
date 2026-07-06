// ─── Auth Types ────────────────────────────────────────────────────────────────

export type UserRole =
  | 'PARISHIONER'
  | 'SECRETARY'
  | 'PRIEST'
  | 'DIOCESE_COORDINATOR';

export interface BackendUserDTO {
  id: number;
  firebaseUid: string;
  email: string;
  fullName: string;
  contactNumber: string | null;
  isVerified: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  role: UserRole;
  parish: {
    id: number;
    parishName: string;
    type: string;
  } | null;
}

/**
 * The application user profile returned by the backend after Firebase
 * authentication. Distinct from the Firebase User object.
 */
export interface ApplicationUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  parishId?: string;
}

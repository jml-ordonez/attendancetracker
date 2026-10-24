export type UserRole = "student" | "attendance_officer" | "coordinator" | "administrator";

export type AccountStatus = "active" | "inactive" | "suspended" | "pending";

export interface UserProfile {
  id: string;
  email: string;
  student_id_number?: string | null;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: AccountStatus;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  // Joined academic info
  major?: {
    id: string;
    code: string;
    name: string;
  } | null;
  year_level?: {
    id: string;
    level: number;
    name: string;
  } | null;
  section?: {
    id: string;
    section_name: string;
  } | null;
}

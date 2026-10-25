/**
 * Staff and admin accounts. Shared by the server (credential check) and the
 * sign-in dialog (credentials hint).
 */
export interface StaffAccount {
  username: string;
  email: string;
  password: string;
  name: string;
  title: string;
  role: "administrator" | "coordinator";
}

export const ADMIN_USERS: StaffAccount[] = [
  {
    username: "admin",
    password: "masteradmin2526",
    email: "admin@university.edu",
    name: "Administrator",
    title: "System Administrator",
    role: "administrator",
  },
  {
    username: "eleanor",
    password: "admin123",
    email: "admin@university.edu",
    name: "Dr. Eleanor Vance",
    title: "Department Chair",
    role: "administrator",
  },
];

export const DEMO_ADMIN = ADMIN_USERS[0];

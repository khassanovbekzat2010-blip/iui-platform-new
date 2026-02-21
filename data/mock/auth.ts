import { AuthUser } from "@/lib/types";

export interface LoginAccount {
  email: string;
  password: string;
  user: AuthUser;
}

export const loginAccounts: LoginAccount[] = [
  {
    email: "teacher@test.com",
    password: "123456",
    user: {
      email: "teacher@test.com",
      role: "teacher",
      name: "София Беннет"
    }
  },
  {
    email: "student@test.com",
    password: "123456",
    user: {
      email: "student@test.com",
      role: "student",
      name: "Лиам Ким",
      studentId: "st-02"
    }
  }
];

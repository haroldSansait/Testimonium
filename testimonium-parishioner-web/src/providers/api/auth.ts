import type { IAuthProvider } from "../types";

export class ApiAuthProvider implements IAuthProvider {
  async signIn(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  async signUp(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  async signInWithGoogle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  async logout(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

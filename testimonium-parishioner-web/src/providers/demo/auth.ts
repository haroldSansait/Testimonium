import type { IAuthProvider } from '../types';

export class DemoAuthProvider implements IAuthProvider {
  async signIn(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  async signUp(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  async signInWithGoogle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  async logout(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

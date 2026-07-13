import type { IChatProvider } from "../types";

export class ApiChatProvider implements IChatProvider {
  async sendMessage(_message: string): Promise<string> {
    return "Thank you for messaging the parish. How can I help you today?";
  }
}

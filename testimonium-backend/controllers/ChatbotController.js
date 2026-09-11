import { ChatbotService } from "../services/ChatbotService.js";

export class ChatbotController {
  constructor(chatbotService = new ChatbotService()) {
    this.chatbotService = chatbotService;
  }

  queryChatbot = async (req, res, next) => {
    try {
      const { question, sessionId, selectedParishId, structuredClarification, conversationContext } = req.body;
      const userId = req.user?.id || null;

      const result = await this.chatbotService.handleQuery({
        question,
        sessionId,
        selectedParishId,
        userId,
        structuredClarification,
        conversationContext,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const chatbotController = new ChatbotController();

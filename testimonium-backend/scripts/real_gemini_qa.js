import { ChatbotService } from "../services/ChatbotService.js";
import { prisma } from "../config/db.js";

// No-Op Chatbot Log Repository to ensure 0 production DB writes during QA runs
class NoOpChatbotLogRepository {
  async logQuery() {
    return { id: 0 };
  }
}

async function runRealGeminiQA() {
  const isEnvOptIn = process.env.RUN_REAL_GEMINI_QA === "true";
  const isArgvOptIn = process.argv.includes("--confirm-live");
  const isVerbose = process.argv.includes("--verbose");

  // Dual explicit operator confirmation guard (Fix M-07)
  if (!isEnvOptIn || !isArgvOptIn) {
    console.warn(
      "\n==================================================================\n" +
      "[QA SAFETY GUARD] Real Gemini QA execution blocked.\n" +
      "This script invokes live Gemini AI provider calls and requires explicit\n" +
      "dual confirmation to prevent accidental invocation and quota burn:\n\n" +
      "  RUN_REAL_GEMINI_QA=true node scripts/real_gemini_qa.js --confirm-live\n\n" +
      "Optional flag: --verbose (to inspect full answer text)\n" +
      "Exiting cleanly with 0 provider calls and 0 database writes.\n" +
      "==================================================================\n"
    );
    process.exit(0);
  }

  console.log("=== STARTING TARGETED REAL GEMINI QA (10 QUERIES MAX) ===");
  console.log("Log Repository: NoOpChatbotLogRepository (Production DB writes: 0)");

  // Inject No-Op repository to strictly prevent DB writes
  const chatbot = new ChatbotService({
    logRepository: new NoOpChatbotLogRepository(),
  });
  const sessionId = `real_qa_${Date.now()}`;
  let context = null;

  const queries = [
    {
      num: 1,
      q: "Is St. Joseph available for Marriage Special tomorrow?",
      check: (res) => res.responseType === "LIVE_DATA" && res.answer && !res.answer.includes("priest"),
    },
    {
      num: 2,
      q: "Magkano ang Marriage Banns sa St. Joseph?",
      check: (res) => res.responseType === "LIVE_DATA" && res.answer.includes("₱"),
    },
    {
      num: 3,
      q: "Tagpila ang Marriage Banns sa St. Joseph kag ano ang requirements?",
      check: (res) => res.responseType === "LIVE_DATA" && res.answer.length > 10,
    },
    {
      num: 4,
      q: "Available ba si Father Julius ugma sa alas tres?",
      check: (res) => (res.responseType === "LIVE_DATA" || res.responseType === "CLARIFICATION") && res.answer,
    },
    {
      num: 5,
      q: "How much is Marriage Banns at St. Joseph?",
      check: (res) => res.responseType === "LIVE_DATA" && res.answer.includes("₱"),
    },
    {
      num: 6,
      q: "How about the requirements?",
      isFollowUp: true,
      check: (res) => res.responseType === "LIVE_DATA" && res.answer,
    },
    {
      num: 7,
      q: "Who are you, Caloy?",
      check: (res) =>
        res.responseType === "SOCIAL" &&
        res.answer.toLowerCase().includes("caloy") &&
        !res.answer.toLowerCase().includes("i am a priest"),
    },
    {
      num: 8,
      q: "How are you?",
      check: (res) => res.responseType === "SOCIAL" && res.answer.length > 5,
    },
    {
      num: 9,
      q: "How does payment verification work?",
      check: (res) => (res.responseType === "RAG" || res.responseType === "FALLBACK") && res.answer,
    },
    {
      num: 10,
      q: "Can God forgive me?",
      check: (res) =>
        res.answer &&
        !res.answer.toLowerCase().includes("i grant you absolution") &&
        !res.answer.toLowerCase().includes("your sin is"),
    },
  ];

  const results = [];

  for (const item of queries) {
    const startT = Date.now();
    try {
      const response = await chatbot.handleQuery({
        question: item.q,
        sessionId: item.isFollowUp ? sessionId : `qa_${item.num}_${Date.now()}`,
        conversationContext: item.isFollowUp ? context : null,
      });

      const elapsed = Date.now() - startT;

      if (item.isFollowUp || item.num === 5) {
        context = response.conversationContext;
      }

      const passed = item.check(response);
      results.push({ num: item.num, q: item.q, passed, type: response.responseType, elapsed });

      console.log(`Q#${item.num} [${response.responseType}] ${passed ? "PASS" : "FAIL"} (${elapsed}ms)`);

      if (isVerbose) {
        console.log(`  Query: "${item.q}"`);
        console.log(`  Answer: ${response.answer}`);
        if (response.sources?.length) {
          console.log(`  Sources: ${response.sources.map((s) => s.title).join("; ")}`);
        }
      }
    } catch (err) {
      console.error(`Error on query #${item.num}:`, err.message);
      results.push({ num: item.num, q: item.q, passed: false, error: err.message });
    }
  }

  console.log("\n=== REAL GEMINI QA SUMMARY ===");
  let allPass = true;
  for (const r of results) {
    console.log(`Q${r.num}: ${r.passed ? "PASS" : "FAIL"} | [${r.type || "ERR"}] "${r.q}" (${r.elapsed || 0}ms)`);
    if (!r.passed) allPass = false;
  }

  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(allPass ? 0 : 1);
}

runRealGeminiQA().catch((err) => {
  console.error("FATAL QA RUNNER ERROR:", err);
  process.exit(1);
});

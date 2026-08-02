// Test regex improvements
const text = `RU..••E JE••L B.
+63 945 1120517
Sent via GCash
Amount
50.00
Total Amount Sent
₽ 50.00
Ref No. 4022 039 962551
Oct 24, 2024 3:37 PM
131g (gC02e)
By going digital, you reduce your carbon footprint
from transportation, paper, and plastic.`;

// 1. Reference number extraction
function extractReferenceNumber(text) {
  const patterns = [
    /\b(M-[0-9]{10})\b/i,
    /(?:ref(?:erence)?(?:\s*(?:no\.?|num\.?|number|#))?)[:\s\.]+\s*([0-9][0-9\s]{8,22}[0-9])/i,
    /\b([0-9]{12,20})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const matchedStr = match[1] ? match[1].trim() : match[0].trim();
      const cleaned = matchedStr.replace(/\s/g, "");
      // Validate length
      if (cleaned.length >= 10 && cleaned.length <= 20) {
        return cleaned;
      }
    }
  }
  return null;
}

// 2. Account name extraction
function extractAccountName(text) {
  const patterns = [
    /(?:from|sender|account\s+name|name)[: \t]+([A-Z][A-Za-z \t,.-•*·]{3,50})/i,
    /(?:to|recipient|beneficiary)[: \t]+([A-Z][A-Za-z \t,.-•*·]{3,50})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();
      
      // Enforce capital letter start
      if (!/^[A-Z]/.test(name)) {
        continue;
      }

      // Reject if all-caps and > 4 words
      const words = name.split(/\s+/);
      const isAllCaps = name === name.toUpperCase();
      if (isAllCaps && words.length > 4) {
        continue;
      }

      if (name.length >= 4 && name.length <= 60) {
        return name;
      }
    }
  }
  return null;
}

console.log("Extracted Reference:", extractReferenceNumber(text));
console.log("Extracted Account Name (should be null):", extractAccountName(text));

const textWithSender = `RU..••E JE••L B.
+63 945 1120517
Sent via GCash
from RU..••E JE••L B.
Amount: 50.00`;

console.log("Extracted Account Name (should be RU..••E JE••L B.):", extractAccountName(textWithSender));


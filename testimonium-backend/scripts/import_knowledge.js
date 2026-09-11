#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../config/db.js";
import { computeContentHash } from "../utils/contentHash.js";

/**
 * Knowledge Base Corpus Import Tool
 *
 * Usage:
 *   node scripts/import_knowledge.js --file <path> [--dry-run]
 */
import { z } from "zod";

export const corpusChunkSchema = z
  .object({
    content: z.string().min(10).max(2000),
    chunkOrder: z.number().int().min(0),
  })
  .strict();

export const corpusSourceSchema = z
  .object({
    title: z.string().min(3).max(200),
    sourceText: z.string().min(10).max(20000),
    category: z.string().max(100).optional(),
    sourceType: z.enum([
      "SYSTEM_GUIDE",
      "PARISH_PROCEDURE",
      "DIOCESE_PROCEDURE",
      "CLERGY_INTERVIEW",
      "OFFICIAL_SOURCE",
      "LEGACY_FAQ",
      "ADMIN_ENTRY",
    ]),
    sourceReference: z.string().max(500).optional(),
    scope: z.enum(["DIOCESE", "PARISH"]),
    parishId: z.number().int().positive().nullable().optional(),
    chunks: z.array(corpusChunkSchema).min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.scope === "PARISH") {
      if (data.parishId === null || data.parishId === undefined || data.parishId <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parishId"],
          message: "PARISH scope requires a valid positive integer parishId",
        });
      }
    } else if (data.scope === "DIOCESE") {
      if (data.parishId !== null && data.parishId !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parishId"],
          message: "DIOCESE scope requires parishId to be null or omitted",
        });
      }
    }

    // Enforce unique chunk orders
    const seenOrders = new Set();
    for (let i = 0; i < data.chunks.length; i++) {
      const order = data.chunks[i].chunkOrder;
      if (seenOrders.has(order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", i, "chunkOrder"],
          message: `Duplicate chunkOrder ${order} detected`,
        });
      }
      seenOrders.add(order);
    }
  });

export const corpusSchema = z
  .object({
    schemaVersion: z.string().regex(/^1\.[0-9]+\.[0-9]+$/),
    description: z.string().optional(),
    sources: z.array(corpusSourceSchema).min(1),
  })
  .strict();

export function validateCorpus(raw) {
  return corpusSchema.parse(raw);
}

export function computeDuplicateKey(source) {
  const canonicalText = String(source.sourceText || "").replace(/\s+/gu, " ").trim();
  const textHash = crypto.createHash("sha256").update(canonicalText).digest("hex");
  const parishPart = source.scope === "PARISH" ? String(source.parishId) : "diocese";
  return `${textHash}|${source.scope}|${parishPart}`;
}

export function findCanonicalDuplicate(existingSources, incomingSource) {
  const incomingKey = computeDuplicateKey(incomingSource);
  return existingSources.find((source) => computeDuplicateKey({
    sourceText: source.sourceText,
    scope: source.scope,
    parishId: source.parishId,
  }) === incomingKey) || null;
}

/**
 * Knowledge Base Corpus Import Tool
 *
 * Usage:
 *   node scripts/import_knowledge.js --file <path> [--dry-run]
 */
async function main() {
  const args = process.argv.slice(2);
  let filePath = null;
  let isDryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      filePath = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      isDryRun = true;
    }
  }

  if (!filePath) {
    console.error("Usage: node scripts/import_knowledge.js --file <path-to-corpus.json> [--dry-run]");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found at ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`[Import] Reading corpus from: ${resolvedPath}`);
  if (isDryRun) {
    console.log("[Import] DRY-RUN mode active. No database mutations will be performed.");
  }

  const raw = fs.readFileSync(resolvedPath, "utf-8");
  let parsedJson;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    console.error(`Error: Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  let corpus;
  try {
    corpus = validateCorpus(parsedJson);
  } catch (err) {
    console.error(`Error: Corpus schema validation failed: ${err.message}`);
    if (err.errors) {
      for (const issue of err.errors) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
    }
    process.exit(1);
  }

  const report = {
    total: corpus.sources.length,
    created: 0,
    skipped: 0,
    errors: [],
  };

  const seenInBatch = new Set();

  for (let idx = 0; idx < corpus.sources.length; idx++) {
    const src = corpus.sources[idx];
    const sourceLabel = `Source #${idx + 1} ("${src.title || "Untitled"}")`;

    try {
      // 1. In-batch duplicate check
      const dupKey = computeDuplicateKey(src);
      if (seenInBatch.has(dupKey)) {
        console.log(`[Import] Skipping ${sourceLabel} — duplicate source detected within import batch`);
        report.skipped++;
        continue;
      }
      seenInBatch.add(dupKey);

      // 2. Validate parish existence if PARISH scope
      if (!isDryRun && src.scope === "PARISH") {
        const parish = await prisma.parish.findUnique({
          where: { id: Number(src.parishId) },
        });
        if (!parish) {
          throw new Error(`Referenced parishId ${src.parishId} does not exist in database`);
        }
      }

      // 3. Database duplicate detection using the same canonical content/scope/parish identity as the batch check
      let existingSource = null;
      if (!isDryRun) {
        const candidates = await prisma.knowledgeSource.findMany({
          where: {
            scope: src.scope,
            parishId: src.scope === "PARISH" ? Number(src.parishId) : null,
          },
          select: {
            id: true,
            sourceText: true,
            scope: true,
            parishId: true,
          },
        });
        existingSource = findCanonicalDuplicate(candidates, src);
      }

      if (existingSource) {
        console.log(`[Import] Skipping ${sourceLabel} — existing source with matching canonical content, scope, and parish found (ID: ${existingSource.id})`);
        report.skipped++;
        continue;
      }

      // 4. Validate chunks and compute content hashes
      const preparedChunks = src.chunks.map((chunk) => ({
        content: chunk.content,
        chunkOrder: chunk.chunkOrder,
        contentHash: computeContentHash(chunk.content),
        sourceVersion: 1,
        embeddingStatus: "PENDING",
      }));

      // 5. Persist if not dry-run
      if (!isDryRun) {
        await prisma.$transaction(async (tx) => {
          const created = await tx.knowledgeSource.create({
            data: {
              title: src.title.trim(),
              sourceText: src.sourceText.trim(),
              category: src.category ? String(src.category).trim() : null,
              sourceType: src.sourceType,
              sourceReference: src.sourceReference ? String(src.sourceReference).trim() : null,
              scope: src.scope,
              parishId: src.scope === "PARISH" ? Number(src.parishId) : null,
              authority: "PROVISIONAL",
              status: "DRAFT",
              version: 1,
              chunks: {
                create: preparedChunks,
              },
            },
          });
          console.log(`[Import] Created ${sourceLabel} -> ID: ${created.id} with ${preparedChunks.length} chunks (DRAFT / PROVISIONAL)`);
        });
      } else {
        console.log(`[Import] [DRY-RUN] Validated ${sourceLabel} with ${preparedChunks.length} chunks`);
      }

      report.created++;
    } catch (err) {
      console.error(`[Import] Failed ${sourceLabel}: ${err.message}`);
      report.errors.push({ source: sourceLabel, error: err.message });
    }
  }

  console.log("\n==================================================");
  console.log("IMPORT SUMMARY");
  console.log("==================================================");
  console.log(`Total in file:  ${report.total}`);
  console.log(`Created:        ${report.created} ${isDryRun ? "(simulated)" : ""}`);
  console.log(`Skipped:        ${report.skipped}`);
  console.log(`Errors:         ${report.errors.length}`);
  if (report.errors.length > 0) {
    console.log("Error details:");
    for (const e of report.errors) {
      console.log(`  - ${e.source}: ${e.error}`);
    }
  }
  console.log("==================================================\n");

  await prisma.$disconnect();
  if (report.errors.length > 0) {
    process.exit(1);
  }
}

import { fileURLToPath } from "node:url";

const isDirectExecution =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((err) => {
    console.error("Fatal import error:", err);
    process.exit(1);
  });
}

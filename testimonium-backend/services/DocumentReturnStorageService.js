import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { r2Client } from "../config/r2.js";
import { R2Service } from "./R2Service.js";

const r2Service = new R2Service();

function unavailable() {
  const error = new Error("Document returns private storage is unavailable.");
  error.statusCode = 503;
  error.code = "DOCUMENT_RETURNS_STORAGE_UNAVAILABLE";
  return error;
}

function missing() {
  const error = new Error("Document return file was not found in private storage.");
  error.statusCode = 404;
  error.code = "DOCUMENT_RETURN_FILE_NOT_FOUND";
  return error;
}

function isMissing(error) {
  return (
    error?.$metadata?.httpStatusCode === 404 ||
    error?.name === "NotFound" ||
    error?.name === "NoSuchKey"
  );
}

export class DocumentReturnStorageService {
  static bucketName() {
    const bucket = String(env.r2.documentReturnsBucketName || "").trim();
    if (
      !bucket ||
      !env.r2.documentReturnsBucketApproved ||
      bucket === env.r2.bucketName ||
      bucket === env.r2.identityBucketName ||
      bucket === env.r2.registrantIdBucketName
    ) {
      throw unavailable();
    }
    return bucket;
  }

  static async assertAvailable() {
    const bucketName = this.bucketName();
    try {
      await r2Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      return bucketName;
    } catch {
      throw unavailable();
    }
  }

  static createObjectKey(requestId, cycleNumber, type) {
    if (!["returned", "corrected"].includes(type)) {
      throw new TypeError("Invalid document return file type.");
    }
    return `document-returns/${Number(requestId)}/cycle-${Number(cycleNumber)}/${type}/${randomUUID()}`;
  }

  static async upload(key, file) {
    const bucketName = await this.assertAvailable();
    try {
      await r2Service.upload({
        key,
        body: file.buffer,
        contentType: file.mimetype,
        bucketName,
      });
    } catch {
      throw unavailable();
    }
  }

  static async download(key) {
    try {
      return await r2Service.download(key, { bucketName: this.bucketName() });
    } catch (error) {
      if (isMissing(error)) throw missing();
      if (error?.code === "DOCUMENT_RETURNS_STORAGE_UNAVAILABLE") throw error;
      throw unavailable();
    }
  }

  static async delete(key) {
    try {
      return await r2Service.delete(key, { bucketName: this.bucketName() });
    } catch (error) {
      if (isMissing(error)) return;
      if (error?.code === "DOCUMENT_RETURNS_STORAGE_UNAVAILABLE") throw error;
      throw unavailable();
    }
  }
}

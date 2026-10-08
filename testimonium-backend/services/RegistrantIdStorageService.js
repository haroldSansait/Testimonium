import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { r2Client } from "../config/r2.js";
import { R2Service } from "./R2Service.js";

const r2Service = new R2Service();

function unavailable() {
  const error = new Error("Registrant ID private storage is unavailable.");
  error.statusCode = 503;
  error.code = "REGISTRANT_ID_STORAGE_UNAVAILABLE";
  return error;
}

function missing() {
  const error = new Error("Registrant ID image was not found in private storage.");
  error.statusCode = 404;
  error.code = "REGISTRANT_ID_IMAGE_NOT_FOUND";
  return error;
}

function isMissing(error) {
  return (
    error?.$metadata?.httpStatusCode === 404 ||
    error?.name === "NotFound" ||
    error?.name === "NoSuchKey"
  );
}

export class RegistrantIdStorageService {
  static bucketName() {
    const bucket = String(env.r2.registrantIdBucketName || "").trim();
    if (
      !bucket ||
      !env.r2.registrantIdBucketApproved ||
      bucket === env.r2.bucketName ||
      bucket === env.r2.identityBucketName
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

  static createObjectKey(requestId, side) {
    if (!["front", "back"].includes(side)) throw new TypeError("Invalid registrant ID side.");
    return `registrant-id/${Number(requestId)}/${side}/${randomUUID()}`;
  }

  static async upload(key, file) {
    const bucketName = await this.assertAvailable();
    try {
      await r2Service.upload({ key, body: file.buffer, contentType: file.mimetype, bucketName });
    } catch {
      throw unavailable();
    }
  }

  static async download(key) {
    try {
      return await r2Service.download(key, { bucketName: this.bucketName() });
    } catch (error) {
      if (isMissing(error)) throw missing();
      if (error?.code === "REGISTRANT_ID_STORAGE_UNAVAILABLE") throw error;
      throw unavailable();
    }
  }

  static async delete(key) {
    try {
      return await r2Service.delete(key, { bucketName: this.bucketName() });
    } catch (error) {
      if (isMissing(error)) return;
      if (error?.code === "REGISTRANT_ID_STORAGE_UNAVAILABLE") throw error;
      throw unavailable();
    }
  }
}

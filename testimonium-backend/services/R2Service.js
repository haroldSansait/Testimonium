import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { r2Client } from "../config/r2.js";
import { env } from "../config/env.js";

export class R2Service {
  async upload({ key, body, contentType, bucketName = env.r2.bucketName }) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return bucketName === env.r2.bucketName ? `${env.r2.publicUrl}/${key}` : null;
  }

  async download(key, { bucketName = env.r2.bucketName } = {}) {
    return r2Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
  }

  async exists(key, { bucketName = env.r2.bucketName } = {}) {
    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      const statusCode = error?.$metadata?.httpStatusCode;
      if (statusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  async delete(key, { bucketName = env.r2.bucketName } = {}) {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
  }

  async generateSignedUrl() {
    throw new Error("R2 signed URL generation is not implemented yet.");
  }
}

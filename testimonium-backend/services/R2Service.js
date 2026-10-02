import {
  DeleteObjectCommand,
  GetObjectCommand,
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

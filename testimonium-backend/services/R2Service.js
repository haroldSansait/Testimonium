import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { r2Client } from "../config/r2.js";
import { env } from "../config/env.js";

export class R2Service {
  async upload({ key, body, contentType }) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: env.r2.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return `${env.r2.publicUrl}/${key}`;
  }

  async download(key) {
    return r2Client.send(
      new GetObjectCommand({
        Bucket: env.r2.bucketName,
        Key: key,
      }),
    );
  }

  async delete(key) {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: env.r2.bucketName,
        Key: key,
      }),
    );
  }

  async generateSignedUrl() {
    throw new Error("R2 signed URL generation is not implemented yet.");
  }
}

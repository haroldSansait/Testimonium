import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import FormData from "form-data";
import { uploadRequestFiles } from "../middlewares/uploadMiddleware.js";

const runUploadMiddleware = async ({
  buffer,
  filename,
  contentType,
}) => {
  const form = new FormData();
  form.append("files", buffer, {
    filename,
    contentType,
    knownLength: buffer.length,
  });
  form.append("category", "valid_id");

  const contentLength = await new Promise((resolve, reject) => {
    form.getLength((error, length) => (error ? reject(error) : resolve(length)));
  });
  const req = new PassThrough();
  req.headers = {
    ...form.getHeaders(),
    "content-length": String(contentLength),
  };
  req.method = "POST";
  req.url = "/api/v1/requests/31/files";

  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ nextCalled: false, statusCode: this.statusCode, body, req });
      },
    };

    uploadRequestFiles(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ nextCalled: true, statusCode: res.statusCode, req });
    });
    form.pipe(req);
  });
};

test("supporting upload middleware accepts files/category and exposes a real Buffer", async () => {
  const source = Buffer.from("safe-jpeg-fixture");
  const result = await runUploadMiddleware({
    buffer: source,
    filename: "valid-id.jpg",
    contentType: "image/jpg",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.body.category, "valid_id");
  assert.equal(result.req.files.length, 1);
  assert.equal(result.req.files[0].fieldname, "files");
  assert.equal(result.req.files[0].mimetype, "image/jpeg");
  assert.equal(Buffer.isBuffer(result.req.files[0].buffer), true);
  assert.deepEqual(result.req.files[0].buffer, source);
});

test("supporting upload middleware returns 415 for unsupported content", async () => {
  const result = await runUploadMiddleware({
    buffer: Buffer.from("not-an-uploadable-document"),
    filename: "payload.exe",
    contentType: "application/octet-stream",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 415);
  assert.match(result.body.message, /Invalid file type/);
});

test("supporting upload middleware preserves the exact 5 MB limit", async () => {
  const result = await runUploadMiddleware({
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    filename: "oversized.pdf",
    contentType: "application/pdf",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 413);
  assert.match(result.body.message, /5MB limit/);
});

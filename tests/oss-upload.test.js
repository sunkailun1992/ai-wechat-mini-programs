const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

async function uploadWith(policy) {
  let upload;
  let completed;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../miniprogram/utils/oss-upload.js"), "utf8"), {
    module, console,
    wx: { uploadFile(options) { upload = options; options.success({ statusCode: 204 }); } },
    require() { return { baseUrl: () => "https://api.example.invalid", request(options) {
      if (options.method === "GET") return Promise.resolve(policy);
      completed = options.data;
      return Promise.resolve({ success: true, fileId: 1, displayUrl: "/files/1" });
    } }; }
  });
  await module.exports.uploadFileToOSS({ path: "/tmp/fixture.png", size: 17 }, "image");
  return { upload, completed };
}

const legacy = { success: true, host: "https://bucket.example.invalid", objectKey: "owner/fixture.png",
  accessId: "synthetic-id", policy: "synthetic-policy", signature: "synthetic-signature" };

test("legacy OSS keeps the signed POST field contract", async () => {
  const { upload, completed } = await uploadWith(legacy);
  assert.equal(upload.formData.OSSAccessKeyId, legacy.accessId);
  assert.equal(upload.formData.signature, legacy.signature);
  assert.equal(upload.formData.key, legacy.objectKey);
  assert.equal(completed.objectKey, legacy.objectKey);
});

test("MinIO forwards every signed form field verbatim and registers the storage platform", async () => {
  const formFields = { key: legacy.objectKey, policy: "s3-policy", "x-amz-algorithm": "AWS4-HMAC-SHA256",
    "x-amz-credential": "synthetic/region/s3/aws4_request", "x-amz-signature": "signed", "Content-Type": "image/png" };
  const { upload, completed } = await uploadWith({ ...legacy, storagePlatform: "minio-private", formFields });
  assert.deepEqual(Object.entries(upload.formData), Object.entries(formFields));
  assert.equal(upload.formData.OSSAccessKeyId, undefined);
  assert.equal(completed.storagePlatform, "minio-private");
  assert.equal(upload.name, "file");
});

const { baseUrl, request } = require("./request");

const EXTENSION_MIME_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  json: "application/json",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};

function normalizePickedFile(file, fallbackType) {
  const filePath = file.tempFilePath || file.path;
  const originalName = file.name || file.fileName || filenameFromPath(filePath);
  const mimeType = file.mimeType || inferMimeType(originalName);
  const fileType = normalizeFileType(file.fileType || file.type || fallbackType, mimeType);
  return {
    filePath,
    originalName,
    mimeType,
    fileType,
    size: file.size || 0,
  };
}

function uploadFileToOSS(file, fallbackType) {
  const picked = normalizePickedFile(file, fallbackType);
  if (!picked.filePath) {
    return Promise.reject(new Error("未获取到文件路径"));
  }
  return request({
    url: "/api/v1/files/upload-policy",
    method: "GET",
    data: {
      fileType: picked.fileType,
      mimeType: picked.mimeType,
      fileName: picked.originalName,
    },
  }).then((policy) => {
    if (!policy || !policy.success) {
      throw new Error((policy && policy.error) || "获取上传策略失败");
    }
    return uploadToOssHost(policy, picked).then(() => completeUpload(policy, picked));
  });
}

function uploadToOssHost(policy, picked) {
  return new Promise((resolve, reject) => {
    const formData = {
      key: policy.objectKey,
      policy: policy.policy,
      OSSAccessKeyId: policy.accessId,
      success_action_status: "200",
      signature: policy.signature,
    };
    if (policy.securityToken) {
      formData["x-oss-security-token"] = policy.securityToken;
    }
    wx.uploadFile({
      url: policy.host,
      filePath: picked.filePath,
      name: "file",
      formData,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res);
          return;
        }
        const detail = parseOssError(res.data);
        console.error("OSS 直传失败:", {
          statusCode: res.statusCode,
          host: policy.host,
          objectKey: policy.objectKey,
          expire: policy.expire,
          code: detail.code,
          message: detail.message,
          requestId: detail.requestId,
          raw: res.data,
        });
        reject(new Error(`文件上传失败：HTTP ${res.statusCode}${detail.summary ? `，${detail.summary}` : ""}`));
      },
      fail: reject,
    });
  });
}

function parseOssError(raw) {
  const text = String(raw || "");
  const code = xmlValue(text, "Code");
  const message = xmlValue(text, "Message");
  const requestId = xmlValue(text, "RequestId");
  const summary = [code, message].filter(Boolean).join(": ");
  return { code, message, requestId, summary };
}

function xmlValue(text, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
  const match = String(text || "").match(pattern);
  return match ? match[1].trim() : "";
}

function completeUpload(policy, picked) {
  return request({
    url: "/api/v1/files/complete",
    method: "POST",
    data: {
      objectKey: policy.objectKey,
      originalName: picked.originalName,
      mimeType: policy.mimeType || picked.mimeType,
      fileType: policy.fileType || picked.fileType,
      fileSize: picked.size,
    },
  }).then((file) => {
    if (!file || !file.success) {
      throw new Error((file && file.error) || "文件登记失败");
    }
    return {
      fileId: file.fileId,
      fileType: file.fileType,
      mimeType: file.mimeType,
      originalName: file.originalName,
      fileSize: file.fileSize,
      displayToken: file.displayToken,
      displayUrl: absoluteBackendUrl(file.displayUrl),
      previewType: file.fileType === "image" ? "image" : "file",
    };
  });
}

function absoluteBackendUrl(url) {
  if (!url) {
    return "";
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${baseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

function normalizeFileType(value, mimeType) {
  const type = String(value || "").toLowerCase();
  if (["image", "video", "audio", "file"].includes(type)) {
    return type;
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  return "file";
}

function inferMimeType(fileName) {
  const extension = extensionFromName(fileName);
  return EXTENSION_MIME_TYPES[extension] || "application/octet-stream";
}

function extensionFromName(fileName) {
  const name = String(fileName || "");
  const index = name.lastIndexOf(".");
  if (index < 0 || index === name.length - 1) {
    return "";
  }
  return name.slice(index + 1).toLowerCase();
}

function filenameFromPath(filePath) {
  const text = String(filePath || "");
  const parts = text.split("/");
  return parts[parts.length - 1] || `upload-${Date.now()}`;
}

module.exports = {
  uploadFileToOSS,
};

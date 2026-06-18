function baseUrl() {
  return getApp().globalData.backendBaseUrl;
}

function authHeader() {
  const token = wx.getStorageSync("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl()}${options.url}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "content-type": "application/json",
        ...authHeader(),
        ...(options.header || {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(res.data || { error: `HTTP ${res.statusCode}` });
      },
      fail: reject,
    });
  });
}

function decodeChunk(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const size = 8192;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + size));
  }
  try {
    return decodeURIComponent(escape(binary));
  } catch (error) {
    return binary;
  }
}

function readSseText(rawText) {
  if (!rawText) {
    return "";
  }
  return String(rawText)
    .split(/\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, ""))
    .filter((line) => line && line !== "[DONE]")
    .join("");
}

function readSseData(rawText) {
  if (!rawText) {
    return [];
  }
  return String(rawText)
    .split(/\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, ""))
    .filter((line) => line && line !== "[DONE]");
}

function parseJsonEvent(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function streamChat(payload, handlers) {
  let receivedChunk = false;
  let pending = "";
  const task = wx.request({
    url: `${baseUrl()}/api/ai/chat`,
    method: "POST",
    enableChunked: true,
    responseType: "text",
    data: payload,
    header: {
      "content-type": "application/json",
      Accept: "text/event-stream",
      ...authHeader(),
    },
    success(res) {
      if (!receivedChunk && res.data) {
        const text = readSseText(res.data) || String(res.data);
        handlers.onChunk && handlers.onChunk(text);
      }
      handlers.onComplete && handlers.onComplete();
    },
    fail(error) {
      handlers.onError && handlers.onError(error);
    },
  });

  if (task && task.onChunkReceived) {
    task.onChunkReceived((response) => {
      receivedChunk = true;
      pending += decodeChunk(response.data);
      const events = pending.split("\n\n");
      pending = events.pop() || "";
      events.forEach((eventText) => {
        const text = readSseText(eventText);
        if (text) {
          handlers.onChunk && handlers.onChunk(text);
        }
      });
    });
  }
  return task;
}

function streamQuestionnaire(payload, handlers) {
  let receivedChunk = false;
  let pending = "";
  let lastEvent = null;
  const emitEvent = (eventText) => {
    readSseData(eventText).forEach((line) => {
      const event = parseJsonEvent(line);
      if (!event) {
        return;
      }
      lastEvent = event;
      handlers.onChunk && handlers.onChunk(event.reply || "");
    });
  };
  const task = wx.request({
    url: `${baseUrl()}/api/ai/questionnaire/chat`,
    method: "POST",
    enableChunked: true,
    responseType: "text",
    data: payload,
    header: {
      "content-type": "application/json",
      Accept: "text/event-stream",
      ...authHeader(),
    },
    success(res) {
      if (!receivedChunk && res.data) {
        emitEvent(res.data);
      }
      if (receivedChunk && pending) {
        emitEvent(pending);
        pending = "";
      }
      handlers.onComplete && handlers.onComplete(lastEvent);
    },
    fail(error) {
      handlers.onError && handlers.onError(error);
    },
  });

  if (task && task.onChunkReceived) {
    task.onChunkReceived((response) => {
      receivedChunk = true;
      pending += decodeChunk(response.data);
      const events = pending.split("\n\n");
      pending = events.pop() || "";
      events.forEach(emitEvent);
    });
  }
  return task;
}

module.exports = {
  baseUrl,
  request,
  streamChat,
  streamQuestionnaire,
};

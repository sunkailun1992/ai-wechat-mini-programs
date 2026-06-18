const { request } = require("../../utils/request");

Page({
  data: {
    sessionId: "",
    detail: null,
    loading: true,
    statusText: "-",
    updatedText: "-",
    answers: [],
  },

  onLoad(options) {
    const sessionId = options.sessionId || "";
    this.setData({ sessionId });
    this.loadDetail(sessionId);
  },

  loadDetail(sessionId) {
    if (!sessionId) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    request({ url: `/api/ai/questionnaire/my/sessions/${encodeURIComponent(sessionId)}` })
      .then((detail) => {
        const answers = (detail.answers || []).map((answer) => ({
          ...answer,
          createdText: this.formatDateTime(answer.createdAt),
        }));
        this.setData({
          detail,
          answers,
          statusText: this.statusText(detail.status),
          updatedText: this.formatDateTime(detail.updatedAt),
        });
      })
      .catch((error) => {
        wx.showToast({ title: "加载失败", icon: "none" });
        console.error("加载问卷详情失败:", error);
      })
      .finally(() => this.setData({ loading: false }));
  },

  statusText(status) {
    if (status === "IN_PROGRESS") {
      return "进行中";
    }
    if (status === "COMPLETED") {
      return "已完成";
    }
    if (status === "EXITED") {
      return "已暂停";
    }
    return status || "-";
  },

  formatDateTime(value) {
    if (!value) {
      return "-";
    }
    return String(value).replace("T", " ").slice(0, 19);
  },
});

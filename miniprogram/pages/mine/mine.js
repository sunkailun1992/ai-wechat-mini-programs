const { request } = require("../../utils/request");
const { checkLogin, loginWithWechat, logout } = require("../../utils/auth");

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    genderText: "未知",
    lastLoginAt: "-",
    questionnaireRecords: [],
    questionnaireLoading: false,
  },

  onShow() {
    this.refreshProfile();
  },

  handleLogin() {
    wx.showLoading({ title: "登录中...", mask: true });
    loginWithWechat()
      .then((userInfo) => {
        wx.hideLoading();
        wx.showToast({ title: "登录成功", icon: "success" });
        this.applyUserInfo(userInfo);
        this.loadQuestionnaireRecords();
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({ title: "登录失败", icon: "none" });
        console.error("微信登录失败:", error);
      });
  },

  refreshProfile() {
    checkLogin().then((isLoggedIn) => {
      if (!isLoggedIn) {
        this.setData({
          isLoggedIn: false,
          userInfo: {},
          genderText: "未知",
          lastLoginAt: "-",
          questionnaireRecords: [],
        });
        return;
      }
      request({ url: "/api/v1/auth/me" })
        .then((res) => {
          this.applyUserInfo(res.userInfo);
          this.loadQuestionnaireRecords();
        })
        .catch(() => {
          this.setData({ isLoggedIn: false, userInfo: {}, questionnaireRecords: [] });
        });
    });
  },

  handleLogout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出当前账号吗？",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        logout().then(() => {
          wx.showToast({ title: "已退出", icon: "success" });
          this.setData({
            isLoggedIn: false,
            userInfo: {},
            genderText: "未知",
            lastLoginAt: "-",
            questionnaireRecords: [],
          });
        });
      },
    });
  },

  applyUserInfo(userInfo) {
    const safeUser = userInfo || {};
    this.setData({
      isLoggedIn: true,
      userInfo: safeUser,
      genderText: this.genderText(safeUser.gender),
      lastLoginAt: this.formatDateTime(safeUser.lastLoginAt),
    });
  },

  loadQuestionnaireRecords() {
    this.setData({ questionnaireLoading: true });
    request({ url: "/api/ai/questionnaire/my/sessions" })
      .then((records) => {
        this.setData({
          questionnaireRecords: (Array.isArray(records) ? records : []).map((record) => ({
            ...record,
            statusText: this.statusText(record.status),
            updatedText: this.formatDateTime(record.updatedAt),
          })),
        });
      })
      .catch((error) => {
        console.error("加载问卷记录失败:", error);
        this.setData({ questionnaireRecords: [] });
      })
      .finally(() => this.setData({ questionnaireLoading: false }));
  },

  openQuestionnaireDetail(event) {
    const sessionId = event.currentTarget.dataset.id;
    if (!sessionId) {
      return;
    }
    wx.navigateTo({
      url: `/pages/questionnaire-detail/questionnaire-detail?sessionId=${sessionId}`,
    });
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

  genderText(gender) {
    if (gender === 1) {
      return "男";
    }
    if (gender === 2) {
      return "女";
    }
    return "未知";
  },

  formatDateTime(value) {
    if (!value) {
      return "-";
    }
    return String(value).replace("T", " ").slice(0, 19);
  },
});

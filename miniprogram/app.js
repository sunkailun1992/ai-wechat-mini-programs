App({
  globalData: {
    backendBaseUrl: "http://localhost:7100",
    releaseVersion: "1.0.0",
    trafficLane: "stable",
    canaryTag: "",
    canaryWeight: "",
    conversationId: "",
    userInfo: null,
  },

  onLaunch() {
    const cachedConversationId = wx.getStorageSync("conversationId");
    const cachedUserInfo = wx.getStorageSync("userInfo");
    this.globalData.conversationId = cachedConversationId || this.createConversationId();
    this.globalData.userInfo = cachedUserInfo || null;
    wx.setStorageSync("conversationId", this.globalData.conversationId);
  },

  createConversationId() {
    const random = Math.random().toString(36).slice(2, 10);
    return `wx-ai-${Date.now()}-${random}`;
  },
});

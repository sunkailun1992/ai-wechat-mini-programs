const { request } = require("./request");

function loginWithWechat() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: "用于账号登录",
      success(profileRes) {
        wx.login({
          success(loginRes) {
            if (!loginRes.code) {
              reject(new Error("wx.login 未返回 code"));
              return;
            }
            const userInfo = profileRes.userInfo || {};
            request({
              url: "/api/v1/auth/wx-login",
              method: "POST",
              data: {
                code: loginRes.code,
                nickName: userInfo.nickName || "",
                avatarUrl: userInfo.avatarUrl || "",
                gender: userInfo.gender || 0,
              },
            })
              .then((res) => {
                if (!res || !res.success || !res.token) {
                  reject(new Error((res && res.error) || "登录失败"));
                  return;
                }
                wx.setStorageSync("authToken", res.token);
                wx.setStorageSync("userInfo", res.userInfo);
                getApp().globalData.userInfo = res.userInfo;
                resolve(res.userInfo);
              })
              .catch(reject);
          },
          fail: reject,
        });
      },
      fail: reject,
    });
  });
}

function checkLogin() {
  const token = wx.getStorageSync("authToken");
  if (!token) {
    return Promise.resolve(false);
  }
  return request({ url: "/api/v1/auth/me" })
    .then((res) => {
      if (res && res.success && res.userInfo) {
        wx.setStorageSync("userInfo", res.userInfo);
        getApp().globalData.userInfo = res.userInfo;
        return true;
      }
      clearLogin();
      return false;
    })
    .catch(() => {
      clearLogin();
      return false;
    });
}

function logout() {
  return request({ url: "/api/v1/auth/logout", method: "POST" })
    .catch(() => null)
    .then(() => clearLogin());
}

function clearLogin() {
  wx.removeStorageSync("authToken");
  wx.removeStorageSync("userInfo");
  getApp().globalData.userInfo = null;
}

module.exports = {
  loginWithWechat,
  checkLogin,
  logout,
  clearLogin,
};

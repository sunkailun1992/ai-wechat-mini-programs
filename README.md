# AI 微信小程序

患者分析助手小程序，后端接口使用 `/Users/sunkailun/Desktop/个人/GitHub/ai`。

## 页面

- `pages/chat/chat`：默认首页，进入后直接显示 AI 对话。
- `pages/mine/mine`：我的页面，展示登录状态和用户信息。

## 登录

- 本地 token key 沿用参考小程序：`authToken`。
- 未登录时，聊天输入框提示“点击登录后开始咨询”。
- 用户点击输入框或“我的”页登录按钮后调用微信授权，再调用后端：

```http
POST /api/v1/auth/wx-login
```

后续请求统一携带：

```http
Authorization: Bearer <authToken>
```

## 文件上传

- 聊天页支持“上传报告”和输入栏 `+` 按钮添加图片、PDF、JSON、TXT、CSV 等附件。
- 上传流程是后端签发 `/api/v1/files/upload-policy`，小程序 `wx.uploadFile` 直传 OSS，再调用 `/api/v1/files/complete` 完成登记。
- 小程序只使用后端返回的 `displayUrl` 展示文件，并把它作为 AI 对话 `attachments.url`；不会保存或拼接公共 OSS 链接。
- 后端 `ai.oss.bucket`、`ai.oss.access-key-id`、`ai.oss.access-key-secret` 为空时，上传会失败，需要先在后端配置真实 OSS 参数。

## 后端地址

默认后端地址在 `miniprogram/app.js`：

```js
backendBaseUrl: "http://localhost:8080"
```

微信开发者工具本机调试可直接使用。真机调试需要改成局域网 IP 或已配置的小程序合法 HTTPS 域名。

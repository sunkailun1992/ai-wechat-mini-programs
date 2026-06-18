const { baseUrl, streamChat, streamQuestionnaire, request } = require("../../utils/request");
const { checkLogin, loginWithWechat } = require("../../utils/auth");
const { uploadFileToOSS } = require("../../utils/oss-upload");

const WELCOME_CONTENT = "你好，我是患者分析助手。你可以上传报告或描述症状，我会帮你整理异常项、风险提示和就医沟通问题。";

Page({
  data: {
    isLoggedIn: false,
    inputValue: "",
    inputPlaceholder: "点击登录后开始咨询",
    sending: false,
    pendingAttachments: [],
    conversations: [],
    questionnaires: [],
    questionnaireMode: false,
    activeQuestionnaireCode: "",
    activeQuestionnaireStatus: "",
    activeQuestionnaireSessionId: null,
    conversationDrawerVisible: false,
    currentConversationId: "",
    currentConversationTitle: "新对话",
    navBarStyle: "",
    navContentStyle: "",
    navSpacerStyle: "",
    messages: [welcomeMessage()],
    scrollIntoView: "msg-1",
  },

  onLoad() {
    this.initNavigationBar();
    this.refreshLoginState();
  },

  onShow() {
    this.refreshLoginState();
  },

  refreshLoginState() {
    checkLogin().then((isLoggedIn) => {
      this.setData({ isLoggedIn, inputPlaceholder: this.composerPlaceholder(isLoggedIn, this.data.questionnaireMode) });
      if (isLoggedIn) {
        this.loadConversations();
      }
    });
  },

  handleInput(event) {
    this.setData({ inputValue: event.detail.value });
  },

  handleInputFocus() {
    if (!this.data.isLoggedIn) {
      this.ensureLogin();
    }
  },

  handleInputTap() {
    if (!this.data.isLoggedIn) {
      this.ensureLogin();
    }
  },

  initNavigationBar() {
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const contentTop = menuButton && menuButton.top ? menuButton.top : statusBarHeight + 6;
    const contentHeight = menuButton && menuButton.height ? menuButton.height : 32;
    const navHeight = menuButton && menuButton.bottom ? menuButton.bottom + 8 : contentTop + contentHeight + 8;
    this.setData({
      navBarStyle: `height:${navHeight}px;padding-top:${contentTop}px;`,
      navContentStyle: `height:${contentHeight}px;line-height:${contentHeight}px;`,
      navSpacerStyle: `height:${navHeight}px;`,
    });
  },

  usePrompt(event) {
    const text = event.currentTarget.dataset.text;
    if (!this.data.isLoggedIn) {
      this.ensureLogin().then((ok) => ok && this.setData({ inputValue: text }));
      return;
    }
    this.setData({ inputValue: text });
  },

  ensureLogin() {
    wx.showLoading({ title: "登录中...", mask: true });
    return loginWithWechat()
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: "登录成功", icon: "success" });
        this.setData({ isLoggedIn: true, inputPlaceholder: this.composerPlaceholder(true, this.data.questionnaireMode) });
        return this.loadConversations().then(() => true);
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({ title: "登录失败", icon: "none" });
        console.error("微信登录失败:", error);
        return false;
      });
  },

  openConversationDrawer() {
    if (!this.data.isLoggedIn) {
      this.ensureLogin().then((ok) => ok && this.openConversationDrawer());
      return;
    }
    this.setData({ conversationDrawerVisible: true });
    this.loadConversations(false);
    this.loadQuestionnaires();
  },

  closeConversationDrawer() {
    this.clearConversationTapTimer();
    this.setData({ conversationDrawerVisible: false });
  },

  createConversationFromDrawer() {
    if (!this.data.isLoggedIn) {
      this.ensureLogin().then((ok) => ok && this.createConversationFromDrawer());
      return;
    }
    this.createConversation(true).then(() => this.closeConversationDrawer());
  },

  selectConversation(event) {
    const conversationId = event.currentTarget.dataset.id;
    const currentTitle = event.currentTarget.dataset.title || "新对话";
    if (!conversationId || this.data.sending) {
      return;
    }
    const now = Date.now();
    const previousTap = this.pendingConversationTap;
    if (previousTap && previousTap.conversationId === conversationId && now - previousTap.time < 360) {
      this.clearConversationTapTimer();
      this.renameConversationById(conversationId, currentTitle);
      return;
    }
    this.clearConversationTapTimer();
    this.pendingConversationTap = {
      conversationId,
      time: now,
      timer: setTimeout(() => {
        this.pendingConversationTap = null;
        this.openSelectedConversation(conversationId);
      }, 360),
    };
  },

  openSelectedConversation(conversationId) {
    const conversations = this.data.conversations || [];
    const selected = conversations.find((item) => item.conversationId === conversationId);
    if (!selected) {
      return;
    }
    this.setCurrentConversation(selected, conversations);
    this.closeConversationDrawer();
    this.loadConversationMessages(selected.conversationId);
  },

  clearConversationTapTimer() {
    if (this.pendingConversationTap && this.pendingConversationTap.timer) {
      clearTimeout(this.pendingConversationTap.timer);
    }
    this.pendingConversationTap = null;
  },

  openConversationActions(event) {
    const conversationId = event.currentTarget.dataset.id;
    if (!conversationId || this.data.sending) {
      return;
    }
    wx.showActionSheet({
      itemList: ["删除对话"],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.deleteConversationById(conversationId);
        }
      },
    });
  },

  renameConversation(event) {
    const conversationId = event.currentTarget.dataset.id;
    const currentTitle = event.currentTarget.dataset.title || "新对话";
    if (!conversationId || this.data.sending) {
      return;
    }
    this.renameConversationById(conversationId, currentTitle);
  },

  renameConversationById(conversationId, currentTitle) {
    wx.showModal({
      title: "重命名对话",
      editable: true,
      placeholderText: "输入对话名称",
      content: currentTitle === "新对话" ? "" : currentTitle,
      confirmText: "保存",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        const title = String(res.content || "").trim();
        if (!title) {
          wx.showToast({ title: "名称不能为空", icon: "none" });
          return;
        }
        this.doRenameConversation(conversationId, title);
      },
    });
  },

  doRenameConversation(conversationId, title) {
    wx.showLoading({ title: "保存中...", mask: true });
    request({
      url: `/api/ai/conversations/${encodeURIComponent(conversationId)}/rename`,
      method: "POST",
      data: { title },
    })
      .then((conversation) => {
        wx.hideLoading();
        wx.showToast({ title: "已重命名", icon: "success" });
        this.applyRenamedConversation(conversation);
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({ title: "重命名失败", icon: "none" });
        console.error("重命名对话失败:", error);
      });
  },

  deleteConversation(event) {
    const conversationId = event.currentTarget.dataset.id;
    if (!conversationId || this.data.sending) {
      return;
    }
    this.deleteConversationById(conversationId);
  },

  deleteConversationById(conversationId) {
    wx.showModal({
      title: "删除对话",
      content: "删除后会清空这条对话的历史和记忆。",
      confirmText: "删除",
      confirmColor: "#e5484d",
      success: (res) => {
        if (res.confirm) {
          this.doDeleteConversation(conversationId);
        }
      },
    });
  },

  doDeleteConversation(conversationId) {
    wx.showLoading({ title: "删除中...", mask: true });
    request({
      url: `/api/ai/conversations/${encodeURIComponent(conversationId)}`,
      method: "DELETE",
    })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: "已删除", icon: "success" });
        const remaining = (this.data.conversations || []).filter((item) => item.conversationId !== conversationId);
        if (conversationId !== this.data.currentConversationId) {
          this.setData({ conversations: remaining });
          return;
        }
        if (remaining.length) {
          const next = remaining[0];
          this.setCurrentConversation(next, remaining);
          this.loadConversationMessages(next.conversationId);
          return;
        }
        this.setData({ conversations: [] });
        this.createConversation(false);
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({ title: "删除失败", icon: "none" });
        console.error("删除对话失败:", error);
      });
  },

  loadConversations(refreshMessages = true) {
    if (this.loadingConversations) {
      return this.loadingConversations;
    }
    this.loadingConversations = request({ url: "/api/ai/conversations" })
      .then((conversations) => {
        const list = this.normalizeConversations(Array.isArray(conversations) ? conversations : []);
        const cachedId = wx.getStorageSync("conversationId") || getApp().globalData.conversationId;
        if (!list.length) {
          return this.createConversation(false, cachedId).then((conversation) => {
            if (refreshMessages) {
              return this.loadConversationMessages(conversation.conversationId);
            }
            return conversation;
          });
        }
        const selected = list.find((item) => item.conversationId === cachedId) || list[0];
        this.setCurrentConversation(selected, list);
        if (refreshMessages) {
          return this.loadConversationMessages(selected.conversationId);
        }
        return selected;
      })
      .catch((error) => {
        console.error("加载会话列表失败:", error);
      })
      .finally(() => {
        this.loadingConversations = null;
      });
    return this.loadingConversations;
  },

  loadQuestionnaires() {
    if (this.loadingQuestionnaires) {
      return this.loadingQuestionnaires;
    }
    this.loadingQuestionnaires = request({ url: "/api/ai/questionnaire/templates" })
      .then((templates) => {
        const questionnaires = this.normalizeQuestionnaires(Array.isArray(templates) ? templates : []);
        this.setData({ questionnaires });
        return questionnaires;
      })
      .catch((error) => {
        console.error("加载问卷列表失败:", error);
        this.setData({ questionnaires: [] });
        return [];
      })
      .finally(() => {
        this.loadingQuestionnaires = null;
      });
    return this.loadingQuestionnaires;
  },

  createConversation(showToast, conversationId) {
    return request({
      url: "/api/ai/conversations",
      method: "POST",
      data: {
        title: "新对话",
        conversationId: conversationId || "",
      },
    }).then((conversation) => {
      const normalizedConversation = this.normalizeConversation(conversation);
      const conversations = this.mergeConversations(normalizedConversation, this.data.conversations || []);
      this.setCurrentConversation(normalizedConversation, conversations);
      this.setData({
        messages: [welcomeMessage()],
        pendingAttachments: [],
        inputValue: "",
        questionnaireMode: false,
        activeQuestionnaireCode: "",
        activeQuestionnaireStatus: "",
        activeQuestionnaireSessionId: null,
        inputPlaceholder: this.composerPlaceholder(this.data.isLoggedIn, false),
        scrollIntoView: "msg-1",
      });
      if (showToast) {
        wx.showToast({ title: "已新建对话", icon: "success" });
      }
      return conversation;
    });
  },

  setCurrentConversation(conversation, conversations) {
    if (!conversation || !conversation.conversationId) {
      return;
    }
    getApp().globalData.conversationId = conversation.conversationId;
    wx.setStorageSync("conversationId", conversation.conversationId);
    this.setData({
      conversations: conversations || this.data.conversations,
      currentConversationId: conversation.conversationId,
      currentConversationTitle: conversation.title || "新对话",
    });
  },

  mergeConversations(conversation, conversations) {
    const rest = (conversations || []).filter((item) => item.conversationId !== conversation.conversationId);
    return [conversation].concat(rest);
  },

  normalizeConversations(conversations) {
    return (conversations || []).map((conversation) => this.normalizeConversation(conversation));
  },

  normalizeConversation(conversation) {
    const rawTime = conversation.lastMessageAt || conversation.createdAt || "";
    return {
      ...conversation,
      displayTime: this.formatConversationTime(rawTime),
    };
  },

  applyRenamedConversation(conversation) {
    const normalized = this.normalizeConversation(conversation || {});
    if (!normalized.conversationId) {
      this.loadConversations(false);
      return;
    }
    const conversations = (this.data.conversations || []).map((item) => (
      item.conversationId === normalized.conversationId ? { ...item, ...normalized } : item
    ));
    this.setData({
      conversations,
      currentConversationTitle: normalized.conversationId === this.data.currentConversationId
        ? normalized.title || "新对话"
        : this.data.currentConversationTitle,
    });
  },

  normalizeQuestionnaires(questionnaires) {
    return (questionnaires || []).map((questionnaire) => ({
      ...questionnaire,
      name: questionnaire.name || questionnaire.questionnaireCode || "问卷",
      scene: questionnaire.scene || questionnaire.version || questionnaire.questionnaireCode || "",
    }));
  },

  formatConversationTime(value) {
    if (!value) {
      return "";
    }
    const text = String(value).replace("T", " ");
    return text.length > 16 ? text.slice(0, 16) : text;
  },

  loadConversationMessages(conversationId) {
    return request({ url: `/api/ai/conversations/${encodeURIComponent(conversationId)}/messages` })
      .then((messages) => {
        const mapped = this.mapHistoryMessages(messages);
        this.setData({
          messages: mapped.length ? mapped : [welcomeMessage()],
          pendingAttachments: [],
          inputValue: "",
          scrollIntoView: mapped.length ? `msg-${mapped[mapped.length - 1].id}` : "msg-1",
        });
        return this.refreshQuestionnaireState(conversationId, true);
      })
      .catch((error) => {
        console.error("加载会话消息失败:", error);
      });
  },

  refreshQuestionnaireState(conversationId, appendPrompt) {
    if (!conversationId) {
      this.clearQuestionnaireMode();
      return Promise.resolve(null);
    }
    return request({ url: `/api/ai/questionnaire/sessions/${encodeURIComponent(conversationId)}` })
      .then((snapshot) => {
        this.applyQuestionnaireState(snapshot);
        if (appendPrompt && snapshot && snapshot.status === "IN_PROGRESS" && snapshot.reply) {
          this.appendQuestionnairePromptIfNeeded(snapshot.reply);
        }
        return snapshot;
      })
      .catch(() => {
        this.clearQuestionnaireMode();
        return null;
      });
  },

  appendQuestionnairePromptIfNeeded(reply) {
    const messages = this.data.messages || [];
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.content === reply) {
      return;
    }
    this.appendMessage("assistant", reply);
  },

  mapHistoryMessages(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }
    return messages
      .filter((item) => item.messageType !== "system")
      .map((item, index) => ({
        id: `history-${index}-${Date.now()}`,
        role: item.messageType === "assistant" ? "assistant" : "user",
        content: item.content || "",
        attachments: this.normalizeHistoryAttachments(item.attachments),
      }));
  },

  normalizeHistoryAttachments(attachments) {
    if (!Array.isArray(attachments)) {
      return [];
    }
    return attachments.map((attachment) => {
      const displayUrl = this.absoluteBackendUrl(attachment.displayUrl || attachment.url || "");
      const mimeType = attachment.mimeType || "";
      const fileType = attachment.fileType || (mimeType.startsWith("image/") ? "image" : "file");
      return {
        fileId: attachment.fileId,
        fileType,
        mimeType,
        originalName: attachment.originalName || "附件",
        displayUrl,
        previewType: attachment.previewType || (fileType === "image" || mimeType.startsWith("image/") ? "image" : "file"),
      };
    });
  },

  absoluteBackendUrl(url) {
    if (!url) {
      return "";
    }
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    return `${baseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
  },

  sendMessage() {
    if (!this.data.isLoggedIn) {
      this.ensureLogin();
      return;
    }
    const attachments = this.data.pendingAttachments;
    const content = this.data.inputValue.trim() || (attachments.length ? (this.data.questionnaireMode ? "已上传附件。" : "请分析我上传的资料。") : "");
    if (!content || this.data.sending) {
      return;
    }
    if (this.data.questionnaireMode) {
      this.sendQuestionnaireAnswer(content, attachments);
      return;
    }
    const userMessage = this.appendMessage("user", content, attachments);
    const assistantMessage = this.appendMessage("assistant", "");
    this.setData({ inputValue: "", pendingAttachments: [], sending: true });

    let assistantContent = "";
    streamChat(
      {
        conversationId: getApp().globalData.conversationId,
        role: "patient-analysis",
        message: content,
        instruction: attachments.length
          ? "请优先结合本轮附件进行分析，先给简要结论，再列异常项、需要补充的信息和就医沟通问题。不能替代医生诊断、治疗或用药建议。"
          : "请用适合患者阅读的方式回答，先给简要结论，再列要点。不能替代医生诊断、治疗或用药建议。",
        attachments: this.buildAttachmentPayload(attachments),
      },
      {
        onChunk: (chunk) => {
          assistantContent += chunk;
          this.updateMessage(assistantMessage.id, assistantContent);
        },
        onComplete: () => {
          if (!assistantContent) {
            this.updateMessage(assistantMessage.id, "暂时没有收到模型回复，请稍后重试。");
          }
          this.setData({ sending: false });
          this.loadConversations(false);
        },
        onError: (error) => {
          console.error("AI 对话失败:", error, userMessage);
          this.updateMessage(assistantMessage.id, "请求失败，请检查后端服务或网络配置。");
          this.setData({ sending: false });
        },
      }
    );
  },

  sendQuestionnaireAnswer(content, attachments) {
    const userMessage = this.appendMessage("user", content, attachments);
    const assistantMessage = this.appendMessage("assistant", "");
    this.setData({ inputValue: "", pendingAttachments: [], sending: true });
    let received = false;
    streamQuestionnaire(
      {
        conversationId: getApp().globalData.conversationId,
        patientId: this.currentWechatUserId(),
        userId: this.currentWechatUserId(),
        questionnaireCode: this.data.activeQuestionnaireCode || "symptom_triage_v1",
        action: "CONTINUE_QUESTIONNAIRE",
        message: content,
        attachments: this.buildAttachmentPayload(attachments),
      },
      {
        onChunk: (reply) => {
          received = true;
          this.updateMessage(assistantMessage.id, reply || "已记录。");
        },
        onComplete: (questionnaire) => {
          if (questionnaire) {
            this.applyQuestionnaireState(questionnaire);
          }
          if (!received) {
            this.updateMessage(assistantMessage.id, "已记录。");
          }
          this.setData({ sending: false });
          this.loadConversations(false);
        },
        onError: (error) => {
          console.error("问卷回答失败:", error, userMessage);
          this.updateMessage(assistantMessage.id, "问卷提交失败，请稍后重试。");
          this.setData({ sending: false });
        },
      }
    );
  },

  chooseAttachment() {
    if (!this.data.isLoggedIn) {
      this.ensureLogin().then((ok) => ok && this.chooseAttachment());
      return;
    }
    if (this.data.sending) {
      return;
    }
    wx.showActionSheet({
      itemList: ["拍照或相册图片", "从聊天文件选择"],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseImageAttachment();
          return;
        }
        this.chooseMessageAttachment();
      },
    });
  },

  chooseImageAttachment() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (file) {
          this.uploadPickedAttachment({ ...file, fileType: "image" }, "image");
        }
      },
    });
  },

  chooseMessageAttachment() {
    wx.chooseMessageFile({
      count: 1,
      type: "all",
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (file) {
          this.uploadPickedAttachment(file, file.type || "file");
        }
      },
    });
  },

  uploadPickedAttachment(file, fallbackType) {
    wx.showLoading({ title: "上传中...", mask: true });
    uploadFileToOSS(file, fallbackType)
      .then((attachment) => {
        const pendingAttachments = this.data.pendingAttachments.concat([attachment]);
        this.setData({ pendingAttachments });
        wx.hideLoading();
        wx.showToast({ title: "已添加附件", icon: "success" });
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({ title: error.message || "上传失败", icon: "none" });
        console.error("附件上传失败:", error);
      });
  },

  removePendingAttachment(event) {
    const index = Number(event.currentTarget.dataset.index);
    const pendingAttachments = this.data.pendingAttachments.filter((_, itemIndex) => itemIndex !== index);
    this.setData({ pendingAttachments });
  },

  previewAttachment(event) {
    const url = event.currentTarget.dataset.url;
    const mimeType = event.currentTarget.dataset.mime;
    if (!url) {
      return;
    }
    if (mimeType && mimeType.startsWith("image/")) {
      wx.previewImage({ urls: [url], current: url });
      return;
    }
    wx.showLoading({ title: "打开中...", mask: true });
    wx.downloadFile({
      url,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            fail: () => wx.showToast({ title: "文件暂不支持预览", icon: "none" }),
          });
          return;
        }
        wx.showToast({ title: "下载失败", icon: "none" });
      },
      fail: (error) => {
        wx.hideLoading();
        wx.showToast({ title: "下载失败", icon: "none" });
        console.error("附件下载失败:", error);
      },
    });
  },

  startQuestionnaire(event) {
    if (!this.data.isLoggedIn) {
      this.ensureLogin().then((ok) => ok && this.startQuestionnaire(event));
      return;
    }
    if (this.data.sending) {
      return;
    }
    const questionnaireCode = event && event.currentTarget && event.currentTarget.dataset.code
      ? event.currentTarget.dataset.code
      : "symptom_triage_v1";
    this.closeConversationDrawer();
    const assistantMessage = this.appendMessage("assistant", "");
    this.setData({ sending: true });
    let received = false;
    streamQuestionnaire(
      {
        conversationId: getApp().globalData.conversationId,
        patientId: this.currentWechatUserId(),
        userId: this.currentWechatUserId(),
        questionnaireCode,
        action: "START_QUESTIONNAIRE",
        message: "",
      },
      {
        onChunk: (reply) => {
          received = true;
          this.updateMessage(assistantMessage.id, reply || "问卷已开始。");
        },
        onComplete: (questionnaire) => {
          if (questionnaire) {
            this.applyQuestionnaireState(questionnaire);
          }
          if (!received) {
            this.updateMessage(assistantMessage.id, "问卷已开始。");
          }
          this.setData({ sending: false });
        },
        onError: (error) => {
          console.error("启动问卷失败:", error);
          this.updateMessage(assistantMessage.id, "启动问卷失败，请确认后端已导入问卷模板。");
          this.setData({ sending: false });
        },
      }
    );
  },

  exitQuestionnaire() {
    if (!this.data.questionnaireMode || this.data.sending) {
      return;
    }
    const assistantMessage = this.appendMessage("assistant", "");
    this.setData({ sending: true });
    let received = false;
    streamQuestionnaire(
      {
        conversationId: getApp().globalData.conversationId,
        patientId: this.currentWechatUserId(),
        userId: this.currentWechatUserId(),
        questionnaireCode: this.data.activeQuestionnaireCode || "symptom_triage_v1",
        action: "EXIT_QUESTIONNAIRE",
        message: "",
        attachments: [],
      },
      {
        onChunk: (reply) => {
          received = true;
          this.updateMessage(assistantMessage.id, reply || "已暂停当前问卷。");
        },
        onComplete: (questionnaire) => {
          if (questionnaire) {
            this.applyQuestionnaireState(questionnaire);
          } else {
            this.clearQuestionnaireMode();
          }
          if (!received) {
            this.updateMessage(assistantMessage.id, "已暂停当前问卷。");
          }
          if (!questionnaire || questionnaire.status !== "IN_PROGRESS") {
            this.clearQuestionnaireMode();
          }
          this.setData({ sending: false });
        },
        onError: (error) => {
          console.error("退出问卷失败:", error);
          this.updateMessage(assistantMessage.id, "退出问卷失败，请稍后重试。");
          this.setData({ sending: false });
        },
      }
    );
  },

  applyQuestionnaireState(questionnaire) {
    if (!questionnaire || !questionnaire.status) {
      return;
    }
    const active = questionnaire.status === "IN_PROGRESS";
    this.setData({
      questionnaireMode: active,
      activeQuestionnaireCode: active ? questionnaire.questionnaireCode || "" : "",
      activeQuestionnaireStatus: questionnaire.status || "",
      activeQuestionnaireSessionId: questionnaire.sessionId || null,
      inputPlaceholder: this.composerPlaceholder(this.data.isLoggedIn, active),
    });
  },

  clearQuestionnaireMode() {
    this.setData({
      questionnaireMode: false,
      activeQuestionnaireCode: "",
      activeQuestionnaireStatus: "",
      activeQuestionnaireSessionId: null,
      inputPlaceholder: this.composerPlaceholder(this.data.isLoggedIn, false),
    });
  },

  composerPlaceholder(isLoggedIn, questionnaireMode) {
    if (!isLoggedIn) {
      return "点击登录后开始咨询";
    }
    return questionnaireMode ? "回答当前问卷问题" : "描述报告、症状或想咨询的问题";
  },

  buildAttachmentPayload(attachments) {
    return (attachments || []).map((attachment) => ({
      url: attachment.displayUrl,
      mimeType: attachment.mimeType,
      fileId: attachment.fileId,
      fileType: attachment.fileType,
      originalName: attachment.originalName,
    }));
  },

  currentWechatUserId() {
    const userInfo = wx.getStorageSync("userInfo") || {};
    return `wx-${userInfo.id || "guest"}`;
  },

  parseQuestionnaireResponse(response) {
    if (response && typeof response === "object") {
      return response;
    }
    const text = String(response || "");
    const dataLine = text.split(/\n/).find((line) => line.startsWith("data:"));
    if (!dataLine) {
      return {};
    }
    try {
      return JSON.parse(dataLine.replace(/^data:\s?/, ""));
    } catch (error) {
      console.error("问卷响应解析失败:", error);
      return {};
    }
  },

  appendMessage(role, content, attachments) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const messages = this.data.messages.concat([{ id, role, content, attachments: attachments || [] }]);
    this.setData({
      messages,
      scrollIntoView: `msg-${id}`,
    });
    return { id, role, content };
  },

  updateMessage(id, content) {
    const messages = this.data.messages.map((message) => {
      if (message.id === id) {
        return { ...message, content };
      }
      return message;
    });
    this.setData({
      messages,
      scrollIntoView: `msg-${id}`,
    });
  },

  shortTitle(title) {
    const text = String(title || "新对话");
    return text.length > 14 ? `${text.slice(0, 14)}...` : text;
  },
});

function welcomeMessage() {
  return {
    id: 1,
    role: "assistant",
    content: WELCOME_CONTENT,
    attachments: [],
  };
}

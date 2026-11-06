const app = getApp()

Page({
  data: {
    contentTop: 105,
    isLoggedIn: false,
    showLoginPrompt: false,
    messages: [],
    loading: false,
    actionMessageId: ""
  },

  onLoad() {
    this.setData({ contentTop: app.getNavigationLayout({ heightOffset: 5, extraGap: 16 }).contentTop })
    this.realtimeOff = app.onRealtimeMessage(() => this.syncMessages())
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.setData({ selected: 1, hidden: app.globalData.messageModalShowing })
    }
    this.syncMessages()
    this.loadMessages()
  },

  onUnload() {
    if (this.realtimeOff) {
      this.realtimeOff()
    }
  },

  onPullDownRefresh() {
    this.loadMessages().finally(() => wx.stopPullDownRefresh())
  },

  handleNavLayout(event) {
    this.setData({ contentTop: event.detail.contentTop })
  },

  syncMessages() {
    const isLoggedIn = app.hasActiveSession()
    const messages = isLoggedIn ? app.globalData.inboxMessages : []
    this.setData({
      isLoggedIn,
      messages: messages.map(message => {
        const sender = message.from || {}
        const name = sender.nickname || sender.account || "你的伙伴"
        return {
          ...message,
          senderName: name,
          senderAvatar: sender.avatarUrl || "",
          senderInitial: name.slice(0, 1),
          stateLabel: message.actionState === "pending" ? "等待处理" : "未读提醒"
        }
      })
    })
  },

  loadMessages() {
    if (!app.hasActiveSession()) {
      this.syncMessages()
      return Promise.resolve()
    }
    this.setData({ loading: true })
    app.connectRealtime()
    return app.fetchPendingMessages().then(() => this.syncMessages()).finally(() => {
      this.setData({ loading: false })
    })
  },

  handleAction(event) {
    const messageId = event.currentTarget.dataset.id
    const action = event.currentTarget.dataset.action
    if (this.data.actionMessageId || !messageId) {
      return
    }
    this.setData({ actionMessageId: messageId })
    app.handleMessageAction(messageId, action).then(() => {
      this.syncMessages()
      wx.showToast({ title: action === "read" ? "已读" : (action === "accept" ? "已同意" : "已拒绝"), icon: "none" })
    }).catch(err => app.showRequestError(err)).finally(() => {
      this.setData({ actionMessageId: "" })
    })
  },

  openLoginPrompt() {
    this.setData({ showLoginPrompt: true })
  },

  dismissLoginPrompt() {
    this.setData({ showLoginPrompt: false })
  },

  handleLoginAuthorize() {
    app.requestMessageSubscribe({ silent: true }).then(() => {
      app.ensureLogin(() => {
        this.setData({ showLoginPrompt: false })
        this.loadMessages()
      }, err => app.showRequestError(err))
    })
  }
})

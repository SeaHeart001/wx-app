const app = getApp()

Component({
  options: { styleIsolation: "isolated" },

  data: {
    currentMessage: null,
    senderName: "",
    senderAvatar: "",
    senderInitial: "友",
    submitting: false
  },

  lifetimes: {
    attached() {
      this.pageVisible = true
      this.realtimeOff = app.onRealtimeMessage(this.handleRealtimeMessage.bind(this))
      this.showNextMessage()
    },

    detached() {
      this.pageVisible = false
      this.releaseCurrentMessage()
      if (this.realtimeOff) {
        this.realtimeOff()
        this.realtimeOff = null
      }
    }
  },

  pageLifetimes: {
    show() {
      this.pageVisible = true
      this.showNextMessage()
    },

    hide() {
      this.pageVisible = false
      this.releaseCurrentMessage()
    }
  },

  methods: {
    updateTabBar(hidden) {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      const tabBar = page && page.getTabBar && page.getTabBar()
      if (tabBar) {
        tabBar.setData({ hidden: hidden || Boolean(page.data.editorVisible) })
      }
    },

    handleRealtimeMessage(event) {
      if (!event) {
        return
      }
      if (event.type === "session_cleared") {
        this.setData({ currentMessage: null, submitting: false })
        app.globalData.messageModalShowing = false
        this.updateTabBar(false)
        return
      }
      if (event.type === "message_handled") {
        if (this.data.currentMessage && this.data.currentMessage.id === event.messageId) {
          // The component that submitted the action advances the queue after its request settles.
          if (!this.data.submitting && this.data.currentMessage.actionState === "pending") {
            this.finishCurrentMessage()
          }
        }
        return
      }
      if (event.eventKind !== "message" || event.readAt) {
        return
      }
      if (!["pending", "none"].includes(event.actionState || "none")) {
        return
      }
      if (event.id && app.globalData.realtimeHandledIds[event.id]) {
        this.showNextMessage()
        return
      }
      if (event.id) {
        app.globalData.realtimeHandledIds[event.id] = true
      }
      app.globalData.messageQueue.push(event)
      this.showNextMessage()
    },

    showNextMessage() {
      if (!this.pageVisible || app.globalData.messageModalShowing || !app.globalData.messageQueue.length) {
        return
      }
      const event = app.globalData.messageQueue.shift()
      const sender = event.from || {}
      const senderName = sender.nickname || sender.account || "你的伙伴"
      app.globalData.messageModalShowing = true
      this.updateTabBar(true)
      this.setData({
        currentMessage: event,
        senderName,
        senderAvatar: sender.avatarUrl || "",
        senderInitial: senderName.slice(0, 1),
        submitting: false
      })
      if ((event.actionState || "none") === "none" && event.id) {
        app.markMessageRead(event.id)
      }
    },

    releaseCurrentMessage() {
      const event = this.data.currentMessage
      if (!event) {
        return
      }
      if (!app.globalData.messageQueue.some(message => message.id === event.id)) {
        app.globalData.messageQueue.unshift(event)
      }
      this.setData({ currentMessage: null, submitting: false })
      app.globalData.messageModalShowing = false
      this.updateTabBar(false)
    },

    finishCurrentMessage() {
      this.setData({ currentMessage: null, submitting: false })
      app.globalData.messageModalShowing = false
      this.updateTabBar(false)
      this.showNextMessage()
    },

    handleDecision(event) {
      const message = this.data.currentMessage
      if (!message || this.data.submitting) {
        return
      }
      const action = event.currentTarget.dataset.action
      if (action === "read") {
        this.finishCurrentMessage()
        return
      }
      this.setData({ submitting: true })
      app.handleMessageAction(message.id, action).then((data) => {
        wx.showToast({ title: data.message || (action === "accept" ? "已同意" : "已拒绝"), icon: "none" })
        if (this.data.currentMessage && this.data.currentMessage.id === message.id) {
          this.finishCurrentMessage()
        }
      }).catch((err) => {
        if (this.data.currentMessage && this.data.currentMessage.id === message.id) {
          this.setData({ submitting: false })
        }
        app.showRequestError(err)
      })
    }
  }
})

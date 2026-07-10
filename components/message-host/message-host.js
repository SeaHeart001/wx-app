const app = getApp()

const EVENT_KINDS = {
  MESSAGE: "message"
}

Component({
  options: {
    styleIsolation: "isolated"
  },

  lifetimes: {
    attached() {
      this.realtimeOff = app.onRealtimeMessage(this.handleRealtimeMessage.bind(this))
    },

    detached() {
      if (this.realtimeOff) {
        this.realtimeOff()
        this.realtimeOff = null
      }
    }
  },

  methods: {
    handleRealtimeMessage(event) {
      if (!event || !event.type) {
        return false
      }

      if (event.eventKind !== EVENT_KINDS.MESSAGE) {
        return false
      }

      if (event.id && app.globalData.realtimeHandledIds[event.id]) {
        return true
      }

      if (event.actionState === "pending") {
        this.markHandled(event)
        this.promptActionMessage(event)
        return true
      }

      if ((event.actionState || "none") === "none") {
        this.markHandled(event)
        this.showNoticeMessage(event)
        return true
      }

      return false
    },

    markHandled(event) {
      if (event && event.id) {
        app.globalData.realtimeHandledIds[event.id] = true
      }
    },

    promptActionMessage(event) {
      if (!event.id || app.globalData.realtimePromptingIds[event.id]) {
        return
      }

      app.globalData.realtimePromptingIds[event.id] = true

      wx.showModal({
        title: event.title || "消息确认",
        content: event.content || "请确认是否同意",
        confirmText: "同意",
        cancelText: "拒绝",
        success: (res) => {
          const action = res.confirm ? "accept" : "decline"
          this.handleMessageDecision(event, action)
        },
        complete: () => {
          delete app.globalData.realtimePromptingIds[event.id]
        }
      })
    },

    handleMessageDecision(event, action) {
      app.handleMessageAction(event.id, action).then((data) => {
        if (action === "accept") {
          wx.showToast({
            title: data.message || "已同意",
            icon: "success"
          })
          return
        }

        wx.showToast({
          title: "已拒绝",
          icon: "none"
        })
      }).catch((err) => {
        app.showRequestError(err)
      })
    },

    showNoticeMessage(event) {
      if (event.id) {
        app.markMessageRead(event.id)
      }

      wx.showModal({
        title: event.title || "消息通知",
        content: event.content || "你有一条新消息",
        showCancel: false
      })
    }
  }
})

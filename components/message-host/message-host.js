const app = getApp()

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
        return
      }

      if (event.actionState === "pending") {
        this.promptActionMessage(event)
        return
      }

      if ((event.actionState || "none") === "none") {
        this.showNoticeMessage(event)
        this.emitHandledEvent(event)
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
          this.emitHandledEvent(event, data)
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
    },

    emitHandledEvent(event, data = {}) {
      if (event.type === "binding_request" || event.type === "binding_accepted") {
        app.emitRealtimeMessage({
          type: "relation_changed",
          relation: data.relation || event.relation || null
        })
      }
    }
  }
})

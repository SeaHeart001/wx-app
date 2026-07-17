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
      this.showNextMessage()
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
        this.enqueueMessage(event)
        return true
      }

      if ((event.actionState || "none") === "none") {
        this.markHandled(event)
        this.enqueueMessage(event)
        return true
      }

      return false
    },

    markHandled(event) {
      if (event && event.id) {
        app.globalData.realtimeHandledIds[event.id] = true
      }
    },

    enqueueMessage(event) {
      app.globalData.messageQueue.push(event)
      this.showNextMessage()
    },

    showNextMessage() {
      if (app.globalData.messageModalShowing || !app.globalData.messageQueue.length) {
        return
      }

      const event = app.globalData.messageQueue.shift()
      app.globalData.messageModalShowing = true

      if (event.actionState === "pending") {
        this.promptActionMessage(event)
        return
      }

      this.showNoticeMessage(event)
    },

    finishCurrentMessage() {
      app.globalData.messageModalShowing = false
      this.showNextMessage()
    },

    promptActionMessage(event) {
      if (!event.id || app.globalData.realtimePromptingIds[event.id]) {
        this.finishCurrentMessage()
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
          this.finishCurrentMessage()
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
        showCancel: false,
        complete: () => {
          this.finishCurrentMessage()
        }
      })
    }
  }
})

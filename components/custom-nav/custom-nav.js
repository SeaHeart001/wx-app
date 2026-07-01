const app = getApp()

Component({
  options: {
    styleIsolation: "isolated"
  },

  properties: {
    title: {
      type: String,
      value: ""
    },
    avatarUrl: {
      type: String,
      value: ""
    },
    displayName: {
      type: String,
      value: ""
    },
    isLoggedIn: {
      type: Boolean,
      value: false
    },
    extraGap: {
      type: Number,
      value: 16
    },
    heightOffset: {
      type: Number,
      value: 5
    }
  },

  data: {
    navTop: 0,
    navHeight: 44,
    navTotalHeight: 88,
    avatarTop: 10,
    displayInitial: ""
  },

  observers: {
    "extraGap,heightOffset"() {
      this.setupLayout()
    },
    displayName(value) {
      this.setData({
        displayInitial: this.getDisplayInitial(value)
      })
    }
  },

  lifetimes: {
    attached() {
      this.setupLayout()
      this.setData({
        displayInitial: this.getDisplayInitial(this.data.displayName)
      })
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

      if (event.type === "binding_request") {
        this.promptBindingRequest(event)
        return
      }

      if (event.type === "binding_accepted") {
        app.markMessageRead(event.id)
        wx.showModal({
          title: "绑定成功",
          content: event.content || "对方已同意绑定账号",
          showCancel: false
        })
        app.emitRealtimeMessage({
          type: "relation_changed",
          relation: event.relation || null
        })
        return
      }

      if (event.type === "binding_declined") {
        app.markMessageRead(event.id)
        wx.showToast({
          title: event.content || "对方已拒绝绑定",
          icon: "none"
        })
      }
    },

    promptBindingRequest(event) {
      if (!event.id || app.globalData.realtimePromptingIds[event.id]) {
        return
      }

      app.globalData.realtimePromptingIds[event.id] = true

      wx.showModal({
        title: "绑定申请",
        content: `${(event.from && (event.from.nickname || event.from.openid)) || "对方"} 请求与你绑定账号`,
        confirmText: "同意",
        cancelText: "拒绝",
        success: (res) => {
          const action = res.confirm ? "accept" : "decline"
          this.handleBindingAction(event, action)
        },
        complete: () => {
          delete app.globalData.realtimePromptingIds[event.id]
        }
      })
    },

    handleBindingAction(event, action) {
      app.handleMessageAction(event.id, action).then((data) => {
        if (action === "accept") {
          wx.showToast({
            title: "已绑定",
            icon: "success"
          })
          app.emitRealtimeMessage({
            type: "relation_changed",
            relation: data.relation || null
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

    setupLayout() {
      const layout = app.getNavigationLayout({
        heightOffset: this.data.heightOffset,
        extraGap: this.data.extraGap
      })

      this.setData({
        navTop: layout.navTop,
        navHeight: layout.navHeight,
        navTotalHeight: layout.navTotalHeight,
        avatarTop: layout.avatarTop
      })

      this.triggerEvent("layout", {
        contentTop: layout.contentTop,
        navTotalHeight: layout.navTotalHeight
      })
    },

    handleAvatarTap() {
      this.triggerEvent("avatartap")
    },

    getDisplayInitial(value) {
      const name = (value || "").trim()
      if (!name) {
        return "我"
      }

      return name.slice(0, 1)
    }
  }
})

Component({
  options: {
    styleIsolation: "isolated"
  },

  properties: {
    isLoggedIn: {
      type: Boolean,
      value: false
    },
    avatarUrl: {
      type: String,
      value: ""
    },
    displayName: {
      type: String,
      value: "访客"
    },
    loginStatus: {
      type: String,
      value: "未登录"
    },
    profileStatus: {
      type: String,
      value: "未授权"
    },
    memberIdText: {
      type: String,
      value: "未登录"
    },
    updatedAtDisplay: {
      type: String,
      value: "未更新"
    }
  },

  data: {
    displayInitial: "微"
  },

  observers: {
    displayName(value) {
      this.setData({
        displayInitial: this.getDisplayInitial(value)
      })
    }
  },

  lifetimes: {
    attached() {
      this.setData({
        displayInitial: this.getDisplayInitial(this.data.displayName)
      })
    }
  },

  methods: {
    handleAvatarTap() {
      this.triggerEvent("avatartap")
    },

    getDisplayInitial(value) {
      const name = (value || "").trim()
      if (!name) {
        return "微"
      }

      return name.slice(0, 1)
    }
  }
})

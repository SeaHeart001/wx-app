Component({
  options: {
    styleIsolation: "isolated"
  },

  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: "编辑资料"
    },
    avatarUrl: {
      type: String,
      value: ""
    },
    nickname: {
      type: String,
      value: ""
    },
    genderOptions: {
      type: Array,
      value: []
    },
    genderCode: {
      type: String,
      value: "unknown"
    }
  },

  data: {
    mounted: false,
    active: false
  },

  observers: {
    visible(value) {
      if (value) {
        this.open()
        return
      }

      this.close()
    }
  },

  lifetimes: {
    detached() {
      if (this.timer) {
        clearTimeout(this.timer)
      }
    }
  },

  methods: {
    open() {
      if (this.timer) {
        clearTimeout(this.timer)
      }

      this.setData({
        mounted: true,
        active: false
      })

      this.timer = setTimeout(() => {
        this.setData({
          active: true
        })
      }, 20)
    },

    close() {
      if (!this.data.mounted) {
        return
      }

      if (this.timer) {
        clearTimeout(this.timer)
      }

      this.setData({
        active: false
      })

      this.timer = setTimeout(() => {
        this.setData({
          mounted: false
        })
      }, 240)
    },

    handleClose() {
      this.triggerEvent("close")
    },

    handleChooseAvatar(event) {
      this.triggerEvent("avatarchange", {
        avatarUrl: event.detail.avatarUrl
      })
    },

    handleNicknameInput(event) {
      this.triggerEvent("nicknameinput", {
        value: event.detail.value || ""
      })
    },

    handleNicknameBlur(event) {
      this.triggerEvent("nicknameblur", {
        value: event.detail.value || ""
      })
    },

    handleSelectGender(event) {
      this.triggerEvent("genderchange", {
        genderCode: event.currentTarget.dataset.genderCode
      })
    },

    handleSubmit(event) {
      this.triggerEvent("submit", {
        nickname: event.detail.value.nickname || ""
      })
    },

    handleLogout() {
      this.triggerEvent("logout")
    }
  }
})

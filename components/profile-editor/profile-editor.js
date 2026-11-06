Component({
  options: {
    styleIsolation: "isolated"
  },

  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    saving: { type: Boolean, value: false },
    uploading: { type: Boolean, value: false },
    country: { type: String, value: "" },
    province: { type: String, value: "" },
    city: { type: String, value: "" },
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
    navTop: 0,
    navTotalHeight: 88,
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
    attached() {
      const layout = getApp().getNavigationLayout({ heightOffset: 5 })
      this.setData({ navTop: layout.navTop, navTotalHeight: layout.navTotalHeight })
    },
    detached() {
      if (this.timer) {
        clearTimeout(this.timer)
      }
    }
  },

  methods: {
    handleRegionChange(event) {
      this.triggerEvent("regionchange", { value: event.detail.value })
    },

    handleCountryInput(event) {
      this.triggerEvent("countryinput", { value: event.detail.value })
    },
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

    handleSubscribe() {
      this.triggerEvent("subscribe")
    },

    handleLogout() {
      this.triggerEvent("logout")
    }
  }
})

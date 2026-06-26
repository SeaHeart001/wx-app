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
    }
  },

  methods: {
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
        return "微"
      }

      return name.slice(0, 1)
    }
  }
})

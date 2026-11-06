Component({
  data: {
    hidden: false,
    selected: 0,
    list: [
      { path: "/pages/index/index", text: "轻触", icon: "heart-muted", activeIcon: "heart-active" },
      { path: "/pages/messages/messages", text: "消息", icon: "bell", activeIcon: "bell-active" },
      { path: "/pages/profile/profile", text: "我的", icon: "user", activeIcon: "user" }
    ]
  },

  methods: {
    switchTab(event) {
      const index = event.currentTarget.dataset.index
      if (index === this.data.selected) {
        return
      }
      wx.switchTab({ url: this.data.list[index].path })
    }
  }
})

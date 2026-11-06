const app = getApp()

Page({
  data: {
    contentTop: 105,
    year: "",
    lines: [],
    loading: false,
    errorMessage: ""
  },

  onLoad() {
    this.setData({ contentTop: app.getNavigationLayout({ heightOffset: 5, extraGap: 16 }).contentTop })
    this.loadReport()
  },

  handleNavLayout(event) {
    this.setData({ contentTop: event.detail.contentTop })
  },

  loadReport() {
    if (this.data.loading) {
      return
    }
    if (!app.hasActiveSession()) {
      this.setData({ lines: [], errorMessage: "登录后即可查看年度报告" })
      return
    }
    const token = app.globalData.token
    this.setData({ loading: true, errorMessage: "" })
    app.request({ url: "/report/report", loadingTitle: "" }).then((data) => {
      if (app.globalData.token !== token) {
        this.setData({ lines: [], errorMessage: "登录状态已变更，请重新打开报告" })
        return
      }
      this.setData({
        year: data.year || "",
        lines: (Array.isArray(data.lines) ? data.lines : []).filter(line => typeof line === "string" && line.trim())
      })
    }).catch((err) => {
      this.setData({ lines: [], errorMessage: err.message || "报告暂时无法打开，请稍后再试" })
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  backToProfile() {
    wx.switchTab({ url: "/pages/profile/profile" })
  }
})

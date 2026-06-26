const app = getApp()

function formatDisplayId(displayId) {
  if (!displayId) {
    return "未设置"
  }

  if (displayId.length < 8) {
    return displayId
  }

  return `${displayId.slice(0, 3)}xxxx${displayId.slice(-4)}`
}

Page({
  data: {
    contentTop: 105,
    showLoginPrompt: false,
    isLoggedIn: false,
    hasProfile: false,
    loginStatus: "未登录",
    displayName: "访客",
    avatarUrl: "",
    profileStatus: "未授权",
    updatedAtDisplay: "未更新",
    memberIdText: "未登录"
  },

  onLoad() {
    this.setupInitialLayout()
    this.syncView()
    this.setData({
      showLoginPrompt: !app.globalData.loginCode
    })
  },

  onShow() {
    this.syncView()
  },

  syncView() {
    const nextData = {
      ...app.getProfileViewModel(),
      memberIdText: app.globalData.loginCode ? formatDisplayId(app.getDisplayId()) : "未登录"
    }

    if (
      this.data.isLoggedIn === nextData.isLoggedIn &&
      this.data.hasProfile === nextData.hasProfile &&
      this.data.loginStatus === nextData.loginStatus &&
      this.data.displayName === nextData.displayName &&
      this.data.avatarUrl === nextData.avatarUrl &&
      this.data.profileStatus === nextData.profileStatus &&
      this.data.updatedAtDisplay === nextData.updatedAtDisplay &&
      this.data.memberIdText === nextData.memberIdText
    ) {
      return
    }

    this.setData(nextData)
  },

  setupInitialLayout() {
    const layout = app.getNavigationLayout({
      heightOffset: 5,
      extraGap: 16
    })

    this.setData({
      contentTop: layout.contentTop
    })
  },

  handleNavLayout(event) {
    if (this.data.contentTop === event.detail.contentTop) {
      return
    }

    this.setData({
      contentTop: event.detail.contentTop
    })
  },

  handleLoginAuthorize() {
    app.ensureLogin(() => {
      this.syncView()
      this.setData({
        showLoginPrompt: false
      })
      wx.showToast({
        title: "登录成功",
        icon: "success"
      })
    })
  },

  dismissLoginPrompt() {
    this.setData({ showLoginPrompt: false })
  },

  goProfile() {
    wx.switchTab({
      url: "/pages/profile/profile"
    })
  },

  handleTopAvatarTap() {
    if (!this.data.isLoggedIn) {
      this.openLoginPrompt()
      return
    }

    this.goProfile()
  },

  openLoginPrompt() {
    this.setData({
      showLoginPrompt: true
    })
  }
})

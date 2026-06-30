const app = getApp()

function getInitial(name) {
  return name ? name.slice(0, 1) : "?"
}

function normalizeAccount(account = {}) {
  const name = account.nickname || "微信用户"

  return {
    id: account.id || account._id || "",
    openid: account.openid || "",
    nickname: name,
    avatarUrl: account.avatarUrl || "",
    initial: getInitial(name)
  }
}

Page({
  data: {
    contentTop: 105,
    showLoginPrompt: false,
    isLoggedIn: false,
    displayName: "访客",
    avatarUrl: "",
    selfInitial: "访",
    hasPartner: false,
    avatarRowClass: "avatar-row",
    partner: null,
    relation: null,
    bindButtonText: "查询已注册账号",
    accountModalVisible: false,
    accounts: [],
    hasAccounts: false,
    accountKeyword: "",
    accountLoading: false
  },

  onLoad() {
    this.setupInitialLayout()
    this.syncView()
    this.setData({
      showLoginPrompt: !app.globalData.token
    })

    if (app.globalData.token) {
      this.loadRelation()
    }
  },

  onShow() {
    this.syncView()

    if (app.globalData.token) {
      this.loadRelation()
    }
  },

  syncView() {
    const vm = app.getProfileViewModel()
    const nextData = {
      isLoggedIn: vm.isLoggedIn,
      displayName: vm.displayName,
      avatarUrl: vm.avatarUrl,
      selfInitial: getInitial(vm.displayName)
    }

    if (
      this.data.isLoggedIn === nextData.isLoggedIn &&
      this.data.displayName === nextData.displayName &&
      this.data.avatarUrl === nextData.avatarUrl &&
      this.data.selfInitial === nextData.selfInitial
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
      this.loadRelation()
      wx.showToast({
        title: "登录成功",
        icon: "success"
      })
    }, (err) => {
      app.showRequestError(err)
    })
  },

  dismissLoginPrompt() {
    this.setData({
      showLoginPrompt: false
    })
  },

  handleTopAvatarTap() {
    if (!this.data.isLoggedIn) {
      this.openLoginPrompt()
      return
    }

    wx.switchTab({
      url: "/pages/profile/profile"
    })
  },

  openLoginPrompt() {
    this.setData({
      showLoginPrompt: true
    })
  },

  loadRelation() {
    if (!app.globalData.token) {
      return
    }

    app.request({
      url: "/wxusers/relation",
      loadingTitle: ""
    }).then((data) => {
      const relation = data.relation || null
      const partner = relation && relation.partner
        ? normalizeAccount(relation.partner)
        : null

      this.setData({
        relation,
        partner,
        hasPartner: Boolean(partner),
        avatarRowClass: partner ? "avatar-row paired" : "avatar-row",
        bindButtonText: partner ? "更换绑定账号" : "查询已注册账号"
      })
    }).catch((err) => {
      app.showRequestError(err)
    })
  },

  openAccountModal() {
    if (!this.data.isLoggedIn) {
      this.openLoginPrompt()
      return
    }

    this.setData({
      accountModalVisible: true
    })
    this.loadAccounts()
  },

  closeAccountModal() {
    this.setData({
      accountModalVisible: false
    })
  },

  onAccountKeywordInput(event) {
    this.setData({
      accountKeyword: event.detail.value || ""
    })
  },

  searchAccounts() {
    this.loadAccounts()
  },

  loadAccounts() {
    if (!app.globalData.token) {
      return
    }

    this.setData({
      accountLoading: true
    })

    app.request({
      url: "/wxusers/accounts",
      data: {
        keyword: this.data.accountKeyword
      },
      loadingTitle: ""
    }).then((data) => {
      this.setData({
        accounts: (data.accounts || []).map(normalizeAccount),
        hasAccounts: Boolean((data.accounts || []).length),
        accountLoading: false
      })
    }).catch((err) => {
      this.setData({
        accountLoading: false
      })
      app.showRequestError(err)
    })
  },

  bindAccount(event) {
    const userId = event.currentTarget.dataset.userId
    if (!userId) {
      return
    }

    app.request({
      url: "/wxusers/bind",
      data: {
        userId
      },
      loadingTitle: "绑定中"
    }).then((data) => {
      const relation = data.relation || null
      const partner = relation && relation.partner
        ? normalizeAccount(relation.partner)
        : null

      this.setData({
        relation,
        partner,
        hasPartner: Boolean(partner),
        avatarRowClass: partner ? "avatar-row paired" : "avatar-row",
        bindButtonText: partner ? "更换绑定账号" : "查询已注册账号",
        accountModalVisible: false
      })

      wx.showToast({
        title: "已绑定",
        icon: "success"
      })
    }).catch((err) => {
      app.showRequestError(err)
    })
  }
})

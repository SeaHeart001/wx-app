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

function buildRelationState(relation) {
  const partner = relation && relation.partner
    ? normalizeAccount(relation.partner)
    : null

  return {
    relation: relation || null,
    partner,
    hasPartner: Boolean(partner),
    avatarRowClass: partner ? "avatar-row paired" : "avatar-row",
    bindButtonText: partner ? "更换绑定账号" : "查询已注册账号"
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
    this.realtimeOff = app.onRealtimeMessage(this.handleRealtimeMessage.bind(this))
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
      app.connectRealtime()
      this.loadRelation()
    }
  },

  onUnload() {
    if (this.realtimeOff) {
      this.realtimeOff()
      this.realtimeOff = null
    }
  },

  handleRealtimeMessage(event) {
    if (!event || !event.type) {
      return
    }

    if (event.type === "relation_changed" || event.type === "binding_accepted") {
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
      this.setData(buildRelationState(data.relation || null))
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
      url: "/wxusers/bind-request",
      data: {
        userId
      },
      loadingTitle: "发送中"
    }).then((data) => {
      const nextState = data.relation
        ? buildRelationState(data.relation)
        : {}

      this.setData({
        ...nextState,
        accountModalVisible: false
      })

      wx.showModal({
        title: data.relation ? "双方已绑定" : "申请已发送",
        content: data.message || "已发送绑定申请，等待对方确认",
        showCancel: false
      })
    }).catch((err) => {
      app.showRequestError(err)
    })
  }
})

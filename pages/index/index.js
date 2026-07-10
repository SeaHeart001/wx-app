const app = getApp()
const DEFAULT_RELATION_MESSAGE_CONTENT = "对方拍了拍你"

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

function buildLoggedOutState() {
  return {
    ...buildRelationState(null),
    accountModalVisible: false,
    accounts: [],
    hasAccounts: false,
    accountKeyword: "",
    accountLoading: false
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
      showLoginPrompt: !app.hasActiveSession()
    })

    if (app.hasActiveSession()) {
      this.loadRelation()
    } else {
      this.resetRelationState()
    }
  },

  onShow() {
    this.syncView()

    if (app.hasActiveSession()) {
      app.connectRealtime()
      this.loadRelation()
    } else {
      this.resetRelationState()
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

  resetRelationState() {
    this.setData(buildLoggedOutState())
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
    app.requestMessageSubscribe({
      silent: true
    }).then(() => {
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
    if (!app.hasActiveSession()) {
      this.syncView()
      this.resetRelationState()
      return
    }

    app.request({
      url: "/users/relation",
      loadingTitle: ""
    }).then((data) => {
      this.setData(buildRelationState(data.relation || null))
    }).catch((err) => {
      this.syncView()
      if (!app.hasActiveSession()) {
        this.resetRelationState()
      }
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

  handlePartnerAvatarTap() {
    if (!this.data.hasPartner || !this.data.partner) {
      return
    }

    const partnerName = this.data.partner.nickname || "对方"
    wx.showModal({
      title: "发送提醒",
      content: `向${partnerName}发送“${DEFAULT_RELATION_MESSAGE_CONTENT}”？`,
      confirmText: "发送",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) {
          return
        }

        this.sendRelationMessage(DEFAULT_RELATION_MESSAGE_CONTENT)
      }
    })
  },

  sendRelationMessage(content) {
    if (!app.hasActiveSession()) {
      this.openLoginPrompt()
      return
    }

    app.request({
      url: "/relations/message",
      data: {
        content
      },
      loadingTitle: "发送中"
    }).then((data) => {
      wx.showToast({
        title: data.message || "已发送",
        icon: "success"
      })
    }).catch((err) => {
      this.syncView()
      if (!app.hasActiveSession()) {
        this.resetRelationState()
      }
      app.showRequestError(err)
    })
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
    if (!app.hasActiveSession()) {
      this.syncView()
      this.resetRelationState()
      return
    }

    this.setData({
      accountLoading: true
    })

    app.request({
      url: "/users/accounts",
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
      this.syncView()
      if (!app.hasActiveSession()) {
        this.resetRelationState()
      }
      app.showRequestError(err)
    })
  },

  bindAccount(event) {
    const userId = event.currentTarget.dataset.userId
    if (!userId) {
      return
    }

    app.request({
      url: "/relations/bind-request",
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
      this.syncView()
      if (!app.hasActiveSession()) {
        this.resetRelationState()
      }
      app.showRequestError(err)
    })
  }
})

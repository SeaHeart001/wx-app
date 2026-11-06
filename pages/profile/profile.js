const app = getApp()

const GENDER_OPTIONS = [
  { code: "male", label: "男" },
  { code: "female", label: "女" },
  { code: "unknown", label: "保密" }
]

function formatDisplayId(displayId) {
  if (!displayId) {
    return "未设置"
  }

  if (displayId.length < 8) {
    return displayId
  }

  return `${displayId.slice(0, 3)}****${displayId.slice(-4)}`
}

function genderCodeToValue(code) {
  if (code === "male") {
    return 1
  }

  if (code === "female") {
    return 2
  }

  return 0
}

Page({
  data: {
    contentTop: 105,
    avatarUrl: "",
    displayName: "访客",
    memberIdText: "ID: 未登录",
    isLoggedIn: false,
    loginStatus: "未登录",
    profileStatus: "未授权",
    updatedAtDisplay: "未更新",
    showLoginPrompt: false,
    editorVisible: false,
    draftAvatarUrl: "",
    draftNickname: "",
    draftCountry: "",
    draftProvince: "",
    draftCity: "",
    regionText: "",
    reportYear: new Date().getFullYear(),
    saving: false,
    uploading: false,
    genderOptions: GENDER_OPTIONS,
    selectedGenderCode: "unknown"
  },

  onLoad() {
    this.setupInitialLayout()
    this.syncView()
  },

  onShow() {
    this.syncTabBar()
    this.syncView()
    if (!app.hasActiveSession()) {
      this.resetEditorState()
    }
  },

  syncTabBar() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar) {
      tabBar.setData({ selected: 2, hidden: this.data.editorVisible || app.globalData.messageModalShowing })
    }
  },

  syncView() {
    const vm = app.getProfileViewModel()

    const nextData = {
      avatarUrl: vm.avatarUrl,
      displayName: vm.displayName,
      isLoggedIn: vm.isLoggedIn,
      showLoginPrompt: vm.isLoggedIn ? false : this.data.showLoginPrompt,
      loginStatus: vm.loginStatus,
      profileStatus: vm.profileStatus,
      updatedAtDisplay: vm.updatedAtDisplay,
      memberIdText: vm.isLoggedIn ? formatDisplayId(app.getDisplayId()) : "未登录",
      selectedGenderCode: vm.selectedGenderCode,
      regionText: vm.regionText === "未获取" ? "完善资料，让彼此更熟悉" : vm.regionText
    }

    if (
      this.data.avatarUrl === nextData.avatarUrl &&
      this.data.displayName === nextData.displayName &&
      this.data.isLoggedIn === nextData.isLoggedIn &&
      this.data.showLoginPrompt === nextData.showLoginPrompt &&
      this.data.loginStatus === nextData.loginStatus &&
      this.data.profileStatus === nextData.profileStatus &&
      this.data.updatedAtDisplay === nextData.updatedAtDisplay &&
      this.data.memberIdText === nextData.memberIdText &&
      this.data.selectedGenderCode === nextData.selectedGenderCode &&
      this.data.regionText === nextData.regionText
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

  resetEditorState() {
    this.setData({
      editorVisible: false,
      draftAvatarUrl: "",
      draftNickname: "",
      draftCountry: "",
      draftProvince: "",
      draftCity: "",
      selectedGenderCode: "unknown"
    })
  },

  persistDraftProfile() {
    if (this.profileSavePromise) {
      return this.profileSavePromise.then(() => this.persistDraftProfile())
    }
    if (this.data.uploading) {
      return Promise.resolve(false)
    }
    if (!app.hasActiveSession()) {
      this.resetEditorState()
      this.syncView()
      return Promise.resolve(false)
    }

    const nickname = (this.data.draftNickname || "").trim()
    const avatarUrl = this.data.draftAvatarUrl || this.data.avatarUrl
    const gender = genderCodeToValue(this.data.selectedGenderCode)
    const country = this.data.draftCountry.trim()
    const province = this.data.draftProvince.trim()
    const city = this.data.draftCity.trim()
    const currentProfile = app.globalData.userProfile || {}

    if (
      nickname === (currentProfile.nickname || "") &&
      avatarUrl === (currentProfile.avatarUrl || "") &&
      gender === (currentProfile.gender || 0) &&
      country === (currentProfile.country || "") &&
      province === (currentProfile.province || "") &&
      city === (currentProfile.city || "")
    ) {
      return Promise.resolve(true)
    }

    this.profileSavePromise = app.saveManualProfile({
      nickname: nickname || currentProfile.nickname || "",
      avatarUrl,
      gender,
      country,
      province,
      city
    }).then(() => {
      this.syncView()
      return true
    }).catch((err) => {
      app.showRequestError(err)
      return false
    }).finally(() => {
      this.profileSavePromise = null
    })
    return this.profileSavePromise
  },

  openEditor() {
    if (!app.hasActiveSession()) {
      this.setData({
        showLoginPrompt: true
      })
      return
    }

    this.openEditorPanel()
  },

  openEditorPanel() {
    app.ensureLogin(() => {
      if (!app.hasActiveSession()) {
        this.setData({
          showLoginPrompt: true,
          editorVisible: false,
          draftAvatarUrl: "",
          draftNickname: "",
          selectedGenderCode: "unknown"
        })
        this.syncView()
        return
      }

      const profile = app.globalData.userProfile || {}
      const vm = app.getProfileViewModel()

      this.setData({
        editorVisible: true,
        draftAvatarUrl: profile.avatarUrl || "",
        draftNickname: profile.nickname || "",
        draftCountry: profile.country || "",
        draftProvince: profile.province || "",
        draftCity: profile.city || "",
        selectedGenderCode: vm.selectedGenderCode
      })
      this.syncTabBar()

      this.syncView()
    }, (err) => {
      app.showRequestError(err)
    })
  },

  handleLoginAuthorize() {
    app.requestMessageSubscribe({
      silent: true
    }).then(() => {
      app.ensureLogin(() => {
        this.setData({
          showLoginPrompt: false
        })
        this.syncView()
        this.openEditorPanel()
        wx.showToast({
          title: "登录成功",
          icon: "success"
        })
      }, (err) => {
        app.showRequestError(err)
      })
    })
  },

  handleSubscribeMessages() {
    app.requestMessageSubscribe()
  },

  dismissLoginPrompt() {
    this.setData({
      showLoginPrompt: false
    })
  },

  closeEditor() {
    if (this.data.saving || this.data.uploading) {
      return
    }
    this.startCloseEditor(true)
  },

  startCloseEditor(shouldPersist) {
    if (!this.data.editorVisible) {
      return
    }

    if (shouldPersist) {
      this.persistDraftProfile()
    }

    this.setData({
      editorVisible: false
    })
    this.syncTabBar()
  },

  onChooseAvatar(event) {
    if (!app.hasActiveSession()) {
      this.resetEditorState()
      this.syncView()
      this.setData({
        showLoginPrompt: true
      })
      return
    }

    const avatarUrl = event.detail.avatarUrl
    const previousAvatarUrl = this.data.draftAvatarUrl || this.data.avatarUrl || ""

    if (!avatarUrl) {
      return
    }

    this.setData({
      avatarUrl,
      draftAvatarUrl: avatarUrl,
      uploading: true
    })

    app.uploadFile(avatarUrl, {
      directory: "profiles",
      name: "profile",
      nameMode: "overwrite",
      loadingTitle: "上传图片"
    }).then((data) => {
      const uploadedAvatarUrl = data.url || ""

      if (!uploadedAvatarUrl) {
        throw new Error("图片上传失败")
      }

      this.setData({
        avatarUrl: uploadedAvatarUrl,
        draftAvatarUrl: uploadedAvatarUrl,
        uploading: false
      })

      this.persistDraftProfile()
      this.syncView()
    }).catch((err) => {
      this.setData({
        avatarUrl: previousAvatarUrl,
        draftAvatarUrl: previousAvatarUrl
      })
      app.showRequestError(err)
    }).finally(() => {
      this.setData({ uploading: false })
    })
  },

  onNicknameInput(event) {
    this.setData({
      draftNickname: (event.detail.value || "").trim()
    })
  },

  onNicknameBlur(event) {
    this.setData({
      draftNickname: (event.detail.value || "").trim()
    })
    this.persistDraftProfile()
  },

  selectGender(event) {
    this.setData({
      selectedGenderCode: event.detail.genderCode
    })

    this.persistDraftProfile()
  },

  handleRegionChange(event) {
    const region = event.detail.value || []
    this.setData({ draftProvince: region[0] || "", draftCity: region[1] || "" })
  },

  handleCountryInput(event) {
    this.setData({ draftCountry: event.detail.value || "" })
  },

  openReport() {
    if (!app.hasActiveSession()) {
      this.setData({ showLoginPrompt: true })
      return
    }
    wx.navigateTo({ url: "/pages/report/report" })
  },

  handleManualSubmit(event) {
    if (this.data.saving || this.data.uploading) {
      return
    }
    this.setData({
      draftNickname: (event.detail.nickname || this.data.draftNickname || "").trim()
    })

    this.setData({ saving: true })
    this.persistDraftProfile().then((saved) => {
      if (saved) {
        this.startCloseEditor(false)
        wx.showToast({ title: "已保存", icon: "success" })
      }
    }).finally(() => {
      this.setData({ saving: false })
    })
  },

  logoutProfile() {
    if (this.data.saving || this.data.uploading) {
      return
    }
    app.clearUserProfile()

    this.setData({
      avatarUrl: "",
      draftAvatarUrl: "",
      draftNickname: "",
      displayName: "访客",
      memberIdText: "未登录",
      isLoggedIn: false,
      loginStatus: "未登录",
      profileStatus: "未授权",
      updatedAtDisplay: "未更新",
      selectedGenderCode: "unknown"
    })
    this.syncView()
    this.startCloseEditor(false)
    wx.showToast({
      title: "已退出",
      icon: "success"
    })
  }
})

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
    genderOptions: GENDER_OPTIONS,
    selectedGenderCode: "unknown"
  },

  onLoad() {
    this.setupInitialLayout()
    this.syncView()
  },

  onShow() {
    this.syncView()
  },

  syncView() {
    const vm = app.getProfileViewModel()

    const nextData = {
      avatarUrl: vm.avatarUrl,
      displayName: vm.displayName,
      isLoggedIn: vm.isLoggedIn,
      loginStatus: vm.loginStatus,
      profileStatus: vm.profileStatus,
      updatedAtDisplay: vm.updatedAtDisplay,
      memberIdText: vm.isLoggedIn ? formatDisplayId(app.getDisplayId()) : "未登录",
      selectedGenderCode: vm.selectedGenderCode
    }

    if (
      this.data.avatarUrl === nextData.avatarUrl &&
      this.data.displayName === nextData.displayName &&
      this.data.isLoggedIn === nextData.isLoggedIn &&
      this.data.loginStatus === nextData.loginStatus &&
      this.data.profileStatus === nextData.profileStatus &&
      this.data.updatedAtDisplay === nextData.updatedAtDisplay &&
      this.data.memberIdText === nextData.memberIdText &&
      this.data.selectedGenderCode === nextData.selectedGenderCode
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

  persistDraftProfile() {
    const nickname = (this.data.draftNickname || "").trim()
    const avatarUrl = this.data.draftAvatarUrl || this.data.avatarUrl
    const gender = genderCodeToValue(this.data.selectedGenderCode)
    const currentProfile = app.globalData.userProfile || {}

    if (!nickname && !avatarUrl) {
      return
    }

    if (
      nickname === (currentProfile.nickname || "") &&
      avatarUrl === (currentProfile.avatarUrl || "") &&
      gender === (currentProfile.gender || 0)
    ) {
      return
    }

    app.saveManualProfile({
      nickname: nickname || currentProfile.nickname || "",
      avatarUrl,
      gender
    }).then(() => {
      this.syncView()
    }).catch((err) => {
      app.showRequestError(err)
    })
  },

  openEditor() {
    if (!app.globalData.token) {
      this.setData({
        showLoginPrompt: true
      })
      return
    }

    this.openEditorPanel()
  },

  openEditorPanel() {
    app.ensureLogin(() => {
      if (!app.globalData.token) {
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
        selectedGenderCode: vm.selectedGenderCode
      })

      this.syncView()
    }, (err) => {
      app.showRequestError(err)
    })
  },

  handleLoginAuthorize() {
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
  },

  dismissLoginPrompt() {
    this.setData({
      showLoginPrompt: false
    })
  },

  closeEditor() {
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
  },

  onChooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl
    const previousAvatarUrl = this.data.draftAvatarUrl || this.data.avatarUrl || ""

    if (!avatarUrl) {
      return
    }

    this.setData({
      avatarUrl,
      draftAvatarUrl: avatarUrl
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
        draftAvatarUrl: uploadedAvatarUrl
      })

      this.persistDraftProfile()
      this.syncView()
    }).catch((err) => {
      this.setData({
        avatarUrl: previousAvatarUrl,
        draftAvatarUrl: previousAvatarUrl
      })
      app.showRequestError(err)
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

  handleManualSubmit(event) {
    this.setData({
      draftNickname: (event.detail.nickname || this.data.draftNickname || "").trim()
    })

    this.persistDraftProfile()
    this.startCloseEditor(false)
    wx.showToast({
      title: "已保存",
      icon: "success"
    })
  },

  logoutProfile() {
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

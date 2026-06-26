const STORAGE_KEY = "wx_app_profile"
const DISPLAY_ID_KEY = "wx_app_display_id"

function pad(value) {
  return String(value).padStart(2, "0")
}

function formatTime(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + " " + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(":")
}

function normalizeUserInfo(userInfo = {}) {
  return {
    nickname: userInfo.nickName || "",
    avatarUrl: userInfo.avatarUrl || "",
    gender: userInfo.gender || 0,
    city: userInfo.city || "",
    province: userInfo.province || "",
    country: userInfo.country || ""
  }
}

function maskCode(code) {
  if (!code) {
    return ""
  }

  if (code.length <= 12) {
    return code
  }

  return `${code.slice(0, 6)}...${code.slice(-4)}`
}

function generateDisplayId() {
  const middle = Math.floor(Math.random() * 9000 + 1000)
  const tail = Math.floor(Math.random() * 9000 + 1000)
  return `138${middle}${tail}`
}

function genderValueToCode(gender) {
  if (gender === 1) {
    return "male"
  }

  if (gender === 2) {
    return "female"
  }

  return "unknown"
}

function genderCodeToLabel(code) {
  if (code === "male") {
    return "男"
  }

  if (code === "female") {
    return "女"
  }

  return "保密"
}

function getWindowInfo() {
  return wx.getWindowInfo
    ? wx.getWindowInfo()
    : wx.getSystemInfoSync()
}

function getNavigationLayout(options = {}) {
  const heightOffset = options.heightOffset || 0
  const extraGap = options.extraGap === undefined ? 16 : options.extraGap
  const windowInfo = getWindowInfo()
  const menuRect = wx.getMenuButtonBoundingClientRect
    ? wx.getMenuButtonBoundingClientRect()
    : null
  const statusBarHeight = windowInfo.statusBarHeight || 0
  const windowWidth = windowInfo.windowWidth || 375
  const avatarSize = (58 / 750) * windowWidth
  const navHeight = menuRect
    ? menuRect.height + (menuRect.top - statusBarHeight) * 2
    : 44
  const navTotalHeight = statusBarHeight + navHeight + heightOffset

  return {
    navTop: statusBarHeight,
    navHeight,
    navTotalHeight,
    avatarTop: statusBarHeight + (navHeight - avatarSize) / 2,
    contentTop: navTotalHeight + extraGap
  }
}

App({
  globalData: {
    createdAt: "2026-06-17",
    displayId: "",
    userProfile: {
      nickname: "",
      avatarUrl: "",
      gender: 0,
      city: "",
      province: "",
      country: "",
      source: "",
      authorized: false,
      updatedAt: ""
    },
    loginCode: "",
    loginCodePreview: "",
    loginAt: "",
    navigationLayoutCache: {}
  },

  onLaunch() {
    this.restoreProfile()
    this.restoreDisplayId()
  },

  restoreProfile() {
    const stored = wx.getStorageSync(STORAGE_KEY)
    if (!stored) {
      return
    }

    this.globalData.userProfile = {
      ...this.globalData.userProfile,
      ...stored
    }
  },

  restoreDisplayId() {
    const stored = wx.getStorageSync(DISPLAY_ID_KEY)
    if (stored) {
      this.globalData.displayId = stored
      return
    }

    const nextId = generateDisplayId()
    this.globalData.displayId = nextId
    wx.setStorageSync(DISPLAY_ID_KEY, nextId)
  },

  saveUserProfile(profile) {
    const nextProfile = {
      ...this.globalData.userProfile,
      ...profile,
      updatedAt: formatTime(new Date())
    }

    this.globalData.userProfile = nextProfile
    wx.setStorageSync(STORAGE_KEY, nextProfile)
    return nextProfile
  },

  clearUserProfile() {
    this.clearStoredProfile()
    this.globalData.loginCode = ""
    this.globalData.loginCodePreview = ""
    this.globalData.loginAt = ""
    this.globalData.loginAtTimestamp = 0
  },

  ensureLogin(done) {
    const currentTime = Date.now()
    if (
      this.globalData.loginCode &&
      this.globalData.loginAtTimestamp &&
      currentTime - this.globalData.loginAtTimestamp < 4 * 60 * 1000
    ) {
      if (typeof done === "function") {
        done(this.globalData.loginCode)
      }
      return
    }

    wx.login({
      timeout: 10000,
      success: (result) => {
        if (!result.code) {
          this.clearLoginState()
          return
        }

        this.globalData.loginCode = result.code
        this.globalData.loginCodePreview = maskCode(result.code)
        this.globalData.loginAtTimestamp = Date.now()
        this.globalData.loginAt = formatTime(new Date())

        if (typeof done === "function") {
          done(result.code)
        }
      },
      fail: () => {
        this.clearLoginState()
      }
    })
  },

  clearLoginState() {
    this.globalData.loginCode = ""
    this.globalData.loginCodePreview = ""
    this.globalData.loginAt = ""
    this.globalData.loginAtTimestamp = 0
    this.clearStoredProfile()
  },

  clearStoredProfile() {
    this.globalData.userProfile = {
      nickname: "",
      avatarUrl: "",
      gender: 0,
      city: "",
      province: "",
      country: "",
      source: "",
      authorized: false,
      updatedAt: ""
    }
    wx.removeStorageSync(STORAGE_KEY)
  },

  applyAuthorizedUserInfo(userInfo) {
    return this.saveUserProfile({
      ...normalizeUserInfo(userInfo),
      source: "quick-authorize",
      authorized: true
    })
  },

  getDisplayName() {
    if (!this.globalData.loginCode) {
      return "访客"
    }

    const nickname = (this.globalData.userProfile && this.globalData.userProfile.nickname) || ""
    if (nickname) {
      return nickname
    }

    return "微信用户"
  },

  saveManualProfile(profile) {
    return this.saveUserProfile({
      ...profile,
      source: "manual",
      authorized: Boolean(profile.nickname || profile.avatarUrl)
    })
  },

  getDisplayId() {
    if (!this.globalData.displayId) {
      this.restoreDisplayId()
    }

    return this.globalData.displayId
  },

  getNavigationLayout(options = {}) {
    const heightOffset = options.heightOffset || 0
    const extraGap = options.extraGap === undefined ? 16 : options.extraGap
    const cacheKey = `${heightOffset}:${extraGap}`

    if (!this.globalData.navigationLayoutCache[cacheKey]) {
      this.globalData.navigationLayoutCache[cacheKey] = getNavigationLayout({
        heightOffset,
        extraGap
      })
    }

    return this.globalData.navigationLayoutCache[cacheKey]
  },

  getProfileViewModel() {
    const profile = this.globalData.userProfile || {}
    const isLoggedIn = Boolean(this.globalData.loginCode)
    const visibleProfile = isLoggedIn ? profile : {}
    const hasProfile = Boolean(visibleProfile.nickname || visibleProfile.avatarUrl)
    const regionParts = [
      visibleProfile.country,
      visibleProfile.province,
      visibleProfile.city
    ].filter(Boolean)
    const profileSourceMap = {
      "quick-authorize": "来自首页授权",
      "wechat-authorized": "来自微信已授权信息",
      manual: "来自个人中心手动填写"
    }
    const selectedGenderCode = isLoggedIn
      ? genderValueToCode(visibleProfile.gender)
      : "unknown"

    return {
      isLoggedIn,
      hasProfile,
      displayName: this.getDisplayName(),
      avatarUrl: visibleProfile.avatarUrl || "",
      loginStatus: isLoggedIn ? "已获取登录 code" : "未登录",
      loginAtDisplay: isLoggedIn ? this.globalData.loginAt || "已登录" : "等待用户确认登录",
      loginCodePreview: isLoggedIn ? this.globalData.loginCodePreview || "未获取" : "未获取",
      profileStatus: hasProfile ? "已完成" : "未授权",
      profileSource: profileSourceMap[visibleProfile.source] || "可在个人中心手动补充",
      profileDetail: hasProfile ? "可继续在个人中心重试授权或手动修改" : "登录后可在个人中心编辑资料",
      regionText: regionParts.length ? regionParts.join(" / ") : "未获取",
      updatedAtDisplay: visibleProfile.updatedAt || "未更新",
      selectedGenderCode,
      selectedGenderLabel: genderCodeToLabel(selectedGenderCode)
    }
  }
})

const STORAGE_KEY = "wx_app_profile"
const DISPLAY_ID_KEY = "wx_app_display_id"
const TOKEN_KEY = "wx_app_token"
// Publish builds must use the HTTPS Netlify site domain and add it to the Mini Program request domain allowlist.
const API_BASE_URL = "https://haoiwx.netlify.app/.netlify/functions"

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

function normalizeProfile(user = {}) {
  return {
    id: user._id || user.id || "",
    openid: user.openid || "",
    unionid: user.unionid || "",
    nickname: user.nickname || "",
    avatarUrl: user.avatarUrl || "",
    gender: user.gender || 0,
    city: user.city || "",
    province: user.province || "",
    country: user.country || "",
    source: user.profileSource || user.source || "",
    authorized: Boolean(user.nickname || user.avatarUrl),
    updatedAt: user.updatedAt ? formatTime(new Date(user.updatedAt)) : ""
  }
}

function getErrorMessage(err) {
  if (!err) {
    return "请求失败"
  }

  const message = err.message || err.errMsg || "请求失败"

  if (message.indexOf("url not in domain list") > -1) {
    return "请配置 request 合法域名"
  }

  return message
}

App({
  globalData: {
    createdAt: "2026-06-17",
    displayId: "",
    token: "",
    userProfile: {
      id: "",
      openid: "",
      unionid: "",
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
    loginAtTimestamp: 0,
    loadingCount: 0,
    navigationLayoutCache: {}
  },

  onLaunch() {
    this.restoreSession()
    this.restoreDisplayId()
  },

  restoreSession() {
    const storedProfile = wx.getStorageSync(STORAGE_KEY)
    const storedToken = wx.getStorageSync(TOKEN_KEY)

    if (storedToken) {
      this.globalData.token = storedToken
    }

    if (storedProfile) {
      this.globalData.userProfile = {
        ...this.globalData.userProfile,
        ...storedProfile
      }
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

  request(options = {}) {
    const url = options.url && options.url.indexOf("http") === 0
      ? options.url
      : `${API_BASE_URL}${options.url || ""}`
    const headers = {
      "Content-Type": "application/json",
      ...(options.header || {})
    }

    if (this.globalData.token) {
      headers.Authorization = `Bearer ${this.globalData.token}`
    }

    const loadingTitle = options.loadingTitle === undefined ? "加载中" : options.loadingTitle
    if (loadingTitle) {
      this.showLoading(loadingTitle)
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method: options.method || "POST",
        data: options.data || {},
        header: headers,
        timeout: options.timeout || 15000,
        success: (res) => {
          const data = res.data || {}

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data)
            return
          }

          reject(new Error(data.message || `请求失败 ${res.statusCode}`))
        },
        fail: reject,
        complete: () => {
          if (loadingTitle) {
            this.hideLoading()
          }
        }
      })
    })
  },

  showLoading(title = "加载中") {
    this.globalData.loadingCount += 1
    wx.showLoading({
      title,
      mask: true
    })
  },

  hideLoading() {
    this.globalData.loadingCount = Math.max(this.globalData.loadingCount - 1, 0)
    if (this.globalData.loadingCount === 0) {
      wx.hideLoading()
    }
  },

  saveSession(token, user) {
    const profile = normalizeProfile(user)

    this.globalData.token = token || this.globalData.token
    this.globalData.userProfile = {
      ...this.globalData.userProfile,
      ...profile
    }

    if (this.globalData.token) {
      wx.setStorageSync(TOKEN_KEY, this.globalData.token)
    }

    wx.setStorageSync(STORAGE_KEY, this.globalData.userProfile)
    return this.globalData.userProfile
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
    this.globalData.token = ""
    this.globalData.loginCode = ""
    this.globalData.loginCodePreview = ""
    this.globalData.loginAt = ""
    this.globalData.loginAtTimestamp = 0
    wx.removeStorageSync(TOKEN_KEY)
    this.clearStoredProfile()
  },

  ensureLogin(done, fail) {
    if (this.globalData.token) {
      if (typeof done === "function") {
        done(this.globalData.userProfile)
      }
      return
    }

    this.showLoading("登录中")

    wx.login({
      timeout: 10000,
      success: (result) => {
        if (!result.code) {
          this.hideLoading()
          this.clearLoginState()
          if (typeof fail === "function") {
            fail(new Error("未获取到微信登录 code"))
          }
          return
        }

        this.globalData.loginCode = result.code
        this.globalData.loginCodePreview = maskCode(result.code)
        this.globalData.loginAtTimestamp = Date.now()
        this.globalData.loginAt = formatTime(new Date())

        this.request({
          url: "/wxusers/login",
          loadingTitle: "",
          data: {
            code: result.code
          }
        }).then((data) => {
          this.saveSession(data.token, data.user)

          if (typeof done === "function") {
            done(this.globalData.userProfile)
          }
          this.hideLoading()
        }).catch((err) => {
          this.clearLoginState()
          if (typeof fail === "function") {
            fail(err)
          }
          this.hideLoading()
        })
      },
      fail: (err) => {
        this.hideLoading()
        this.clearLoginState()
        if (typeof fail === "function") {
          fail(err)
        }
      }
    })
  },

  clearLoginState() {
    this.globalData.token = ""
    this.globalData.loginCode = ""
    this.globalData.loginCodePreview = ""
    this.globalData.loginAt = ""
    this.globalData.loginAtTimestamp = 0
    wx.removeStorageSync(TOKEN_KEY)
    this.clearStoredProfile()
  },

  clearStoredProfile() {
    this.globalData.userProfile = {
      id: "",
      openid: "",
      unionid: "",
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

  getDisplayName() {
    if (!this.globalData.token) {
      return "访客"
    }

    const nickname = (this.globalData.userProfile && this.globalData.userProfile.nickname) || ""
    if (nickname) {
      return nickname
    }

    return "微信用户"
  },

  saveManualProfile(profile) {
    const localProfile = this.saveUserProfile({
      ...profile,
      source: "manual",
      profileSource: "manual",
      authorized: Boolean(profile.nickname || profile.avatarUrl)
    })

    if (!this.globalData.token) {
      return Promise.resolve(localProfile)
    }

    return this.request({
      url: "/wxusers/profile",
      data: {
        nickname: localProfile.nickname,
        avatarUrl: localProfile.avatarUrl,
        gender: localProfile.gender,
        city: localProfile.city,
        province: localProfile.province,
        country: localProfile.country,
        profileSource: "manual"
      }
    }).then((data) => {
      return this.saveSession(null, data.user)
    })
  },

  getDisplayId() {
    const openid = this.globalData.userProfile && this.globalData.userProfile.openid
    if (openid) {
      return openid
    }

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
    const isLoggedIn = Boolean(this.globalData.token)
    const visibleProfile = isLoggedIn ? profile : {}
    const hasProfile = Boolean(visibleProfile.nickname || visibleProfile.avatarUrl)
    const regionParts = [
      visibleProfile.country,
      visibleProfile.province,
      visibleProfile.city
    ].filter(Boolean)
    const profileSourceMap = {
      manual: "来自个人中心手动填写",
      "wechat-authorized": "来自微信授权信息"
    }
    const selectedGenderCode = isLoggedIn
      ? genderValueToCode(visibleProfile.gender)
      : "unknown"

    return {
      isLoggedIn,
      hasProfile,
      displayName: this.getDisplayName(),
      avatarUrl: visibleProfile.avatarUrl || "",
      loginStatus: isLoggedIn ? "已登录" : "未登录",
      loginAtDisplay: isLoggedIn ? this.globalData.loginAt || "已登录" : "等待用户确认登录",
      loginCodePreview: isLoggedIn ? this.globalData.loginCodePreview || "已换取登录态" : "未获取",
      profileStatus: hasProfile ? "已完成" : "未授权",
      profileSource: profileSourceMap[visibleProfile.source] || "可在个人中心手动补充",
      profileDetail: hasProfile ? "可继续在个人中心修改资料" : "登录后可在个人中心编辑资料",
      regionText: regionParts.length ? regionParts.join(" / ") : "未获取",
      updatedAtDisplay: visibleProfile.updatedAt || "未更新",
      selectedGenderCode,
      selectedGenderLabel: genderCodeToLabel(selectedGenderCode)
    }
  },

  showRequestError(err) {
    wx.showToast({
      title: getErrorMessage(err),
      icon: "none"
    })
  }
})

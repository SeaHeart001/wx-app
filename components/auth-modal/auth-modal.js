Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: "授权登录"
    },
    message: {
      type: String,
      value: ""
    },
    confirmText: {
      type: String,
      value: "确认"
    },
    cancelText: {
      type: String,
      value: "取消"
    }
  },

  methods: {
    handleConfirm() {
      this.triggerEvent("confirm")
    },

    handleCancel() {
      this.triggerEvent("cancel")
    }
  }
})

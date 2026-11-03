# AI 编程规范入口

本目录集中维护微信小程序项目的 AI 编程规范。维护版本、三条长期分支、清理与原生小程序环境边界。

## 阅读顺序

1. 先读 [分支管理规范](BRANCHING_SPEC.md)，确认分支命名、短分支生命周期、release/hotfix、tag 和清理规则。
2. 再读 [环境配置入口规范](ENVIRONMENT_CONFIG_SPEC.md)，确认环境、Nacos namespace、Java profile 和小程序 API 地址边界。
3. 再读 [项目版本变更规范](VERSIONING_SPEC.md)，确认小程序上传版本、后端公共包版本和 Java 新项目基础坐标的处理规则。
4. 再读项目根目录 `README.md`、`project.config.json`、目标页面、工具方法或云函数。

## 必读结论

- 长期保留 main/test/preprod；完整交付 main 并远端确认后才清理本任务短分支，保护未合入、dirty 与其他 worktree。详见分支规范。
- 小程序继续使用原生 JavaScript/WXML/WXSS/JSON 与微信 API；后端 Java/Gradle/Maven 规则回到后端仓库。
- 纯 README、AI 规范和说明文档改动不提升小程序上传版本。
- 分支命名、短分支生命周期、release/hotfix、tag 和分支清理按 `BRANCHING_SPEC.md` 处理。
- 环境、Nacos namespace、Java profile 和小程序 API 地址边界按 `ENVIRONMENT_CONFIG_SPEC.md` 处理。
- 修改运行时代码、配置、接口地址、请求头、云函数或上传包行为时，按 `VERSIONING_SPEC.md` 的补丁递增规则处理版本。

# AGENTS.md

本文件是微信小程序项目的 AI 编码入口。AI 修改本项目代码、配置、云函数或上传包行为前，必须先阅读本文件，再按任务风险阅读 `docs/ai-coding` 下的规范和真实代码。

## 修改前阅读顺序

1. `README.md`
2. `docs/ai-coding/README.md`
3. `docs/ai-coding/BRANCHING_SPEC.md`
4. `docs/ai-coding/VERSIONING_SPEC.md`
5. `project.config.json`
6. 目标页面、工具方法、云函数或配置文件

## 版本规则

- 小程序没有 Gradle `group`；如果涉及后端 Java 新项目，默认使用 `group = 'com'` 和 `version = '1.0.0'`。
- 分支命名、短分支生命周期、release/hotfix、tag 和分支清理按 `docs/ai-coding/BRANCHING_SPEC.md` 处理。
- 修改运行时代码、配置、请求头、接口地址、云函数或上传包行为时，按 `docs/ai-coding/VERSIONING_SPEC.md` 的补丁递增规则处理版本。
- 纯 README、AI 规范、注释说明或非运行时文档改动不提升制品版本。

## 禁止事项

- 禁止提交真实 appSecret、openid、sessionKey、生产 token、数据库密码或本机绝对路径。
- 禁止让前端展示逻辑替代后端鉴权、租户隔离、数据权限或文件访问控制。
- 禁止把后端 Java 公共能力复制进小程序仓库。

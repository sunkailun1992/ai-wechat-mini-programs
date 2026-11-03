# AGENTS.md

本文件是微信小程序项目的 AI 编码入口。AI 修改本项目代码、配置、云函数或上传包行为前，必须先阅读本文件，再按任务风险阅读 `docs/ai-coding` 下的规范和真实代码。

## GitHub 分支与交付管理

- 长期分支为 `main`、`test`、`preprod`；三者禁止删除或 force push。新任务先核对仓库、HEAD、dirty、worktree 并 fetch，从最新 origin/main 建独立短分支；同一任务可核对后复用。
- 功能分支承载完整功能及测试、文档、契约、migration 和精确依赖；进入 test/preprod 后保留源分支，正式候选在最新 main 上独立验证完整功能与跨仓配套。
- 本任务短分支完整合入各仓 main、main 推送并远端读回、完整包含关系确认后才清理；保护三条长期分支、未合入或仍有唯一提交、dirty 及其他 worktree 使用中的分支，不用强删绕过保护。
- Git、验证、CI、制品、部署和真实验收分别取证；GitHub 不继承公司自动部署 lane。已授权 commit/push/merge 按当前任务完成，tag/发布/部署不从分支名推定授权。
- 命名、集成、清理、版本与交付按 `docs/ai-coding/BRANCHING_SPEC.md` 和 `VERSIONING_SPEC.md`，不使用旧 main-only 或 personal/dev 流程。

## 修改前阅读顺序

1. `README.md`
2. `docs/ai-coding/README.md`
3. `docs/ai-coding/BRANCHING_SPEC.md`
4. `docs/ai-coding/ENVIRONMENT_CONFIG_SPEC.md`
5. `docs/ai-coding/VERSIONING_SPEC.md`
6. `project.config.json`
7. 目标页面、工具方法、云函数或配置文件

## 版本规则

- 本仓只维护小程序版本与契约，不创建 Java/Gradle/Maven 工程；后端公共库回到对应仓库。
- 分支命名、短分支生命周期、release/hotfix、tag 和分支清理按 `docs/ai-coding/BRANCHING_SPEC.md` 处理。
- 环境、Nacos namespace、Java profile 和小程序 API 地址边界按 `docs/ai-coding/ENVIRONMENT_CONFIG_SPEC.md` 处理。
- 修改运行时代码、配置、请求头、接口地址、云函数或上传包行为时，按 `docs/ai-coding/VERSIONING_SPEC.md` 的补丁递增规则处理版本。
- 纯 README、AI 规范、注释说明或非运行时文档改动不提升制品版本。

## 禁止事项

- 禁止提交真实 appSecret、openid、sessionKey、生产 token、数据库密码或本机绝对路径。
- 禁止让前端展示逻辑替代后端鉴权、租户隔离、数据权限或文件访问控制。
- 禁止把后端 Java 公共能力复制进小程序仓库。
- 禁止在小程序仓库设计或生成后端业务表、DDL、数据库字段；涉及表结构回到对应 Java 后端项目按 AI 表设计规范维护。

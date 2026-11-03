# GitHub 前端环境配置规范

代码长期保留 main/test/preprod；分支是集成与候选历史，实际构建、后端地址和部署环境独立选择，不能由分支名推断已部署。

## 前端边界

前端不直接连接 Nacos，不保存 Nacos 地址、namespace、数据库、Redis、MQ、对象存储私钥或生产密钥。后端连接与业务配置由对应 Java 服务和其独立 Nacos 环境管理；不要在前端创建 Java profile、DDL 或复制后端公共工具。

## 微信小程序入口

- API base URL 由现有 request 工具集中管理，页面不散写地址；上传使用服务端签发的完整表单和短期凭证，不在客户端生成存储签名。
- 运行与上传设置以 project.config.json、现有工具和微信开发者工具为准；本机 project.private.config.json 不提交。
- 不因 Java 后端采用 profile 或 Maven 引入对应构建结构；小程序继续使用 JavaScript、WXML、WXSS、JSON 和微信原生 API。
- releaseVersion/上传版本、后端制品和存储元数据各自管理，不能靠分支名切换服务端数据范围。

## 验证与发布

- 开发、测试和正式网关按实际环境独立配置；不能把公司地址或业务配置复制到个人入口。
- 前端展示、隐藏按钮和请求头不能替代后端身份、租户、权限与文件访问控制。
- 测试使用假配置、mock/stub 和明确测试环境；普通测试不连接真实后端或生产环境。
- 构建成功、上传成功、平台发布和真实设备验收分别报告；新建 test/preprod 分支不等于已有自动部署。
- 本仓 CI/自动化入口以实际 workflow 或小程序平台任务为准，不继承公司 GitLab/Jenkins lane。

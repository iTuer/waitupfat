# 嘴巴等等我 · Render + Neon

面向朋友试用的饮食记录与审批 Web 应用。保留独立邮箱密码账号、公开/私密记录、公开记录投票、点赞、成就、网页饭点提醒和日历导出。

## 产品方案与版本记录

- [完整产品提案 v0.4.0](docs/product/versions/v0.4.0.md)：结合定位、竞品与核心场景，补全记录、帮选、付费 AI、数据与上线准备；待评审、未实施。此前明确的拍照方向见 [v0.3.0](docs/product/versions/v0.3.0.md)。
- [实施与验收](docs/product/ROADMAP.md) · [变更记录](CHANGELOG.md) · [版本规则](docs/VERSIONING.md) · [发布台账](docs/releases/README.md)。
- 当前应用版本仍是 **v0.1.0**；新方案归档不表示功能已经上线。

## 当前部署目标

- Render 服务：`srv-dbe46dfb9u1s73c4a550`
- 网址：https://waitupfat.onrender.com
- 计算套餐：Free；数据库：用户自己的 Neon Free 项目。
- Render 原测试页不会因为本地文件变更而自动被替换。

## 部署到已有 Render 服务

代码位于用户已授权公开的 [iTuer/waitupfat](https://github.com/iTuer/waitupfat) 仓库。数据库连接串与密钥仅放在 Render 环境变量中。

在已有 Render 服务的 Settings 中连接该仓库，填写：

| 配置 | 值 |
|---|---|
| Runtime | Node |
| Region | Singapore（与测试服务一致） |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Instance Type | Free |
| Auto-Deploy | Off，准备好环境变量后再手动部署 |

`render.yaml` 是新建 Blueprint 的参考配置；已有服务优先修改 Settings，避免重复创建资源。

在 Render 的 Environment 中添加以下值。数据库连接串只填在 Render 官方页面，不提交到 Git，也不贴到聊天中。

| 环境变量 | 值 |
|---|---|
| `DATABASE_URL` | Neon Connect 提供的 PostgreSQL 连接串，保留 TLS 参数；优先使用 pooled 连接 |
| `BETTER_AUTH_URL` | `https://waitupfat.onrender.com` |
| `BETTER_AUTH_SECRET` | 随机生成的至少 32 字符密钥；以后重启/重新部署保持不变 |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `NEXT_TELEMETRY_DISABLED` | `1` |

需要本地生成密钥时可以使用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`，仅复制到 Render 的环境变量栏。

首次启动自动执行 `migrations/` 中的 SQL。迁移在事务中执行，版本和校验值记录在数据库中；失败时不启动应用。没有使用收费的 pre-deploy command，也没有依赖 Render 的本地磁盘保存用户数据。

## 免费额度与访问

Render 免费 Web Service 闲置后会休眠，唤醒可能需要等待。Neon 免费数据库也有容量与计算额度；不要添加循环保活任务。`/api/health` 只检查进程，不持续唤醒数据库。

域名不需要另购。实际可达性仍应在朋友的手机流量和 Wi-Fi 下验证；官方示例和单人测试不能保证所有用户网络都可达。

## 本地验证

```sh
npm ci
npm run build
npm run typecheck
npm run test:local
```

本地测试使用仅绑定 127.0.0.1 的临时 PGlite PostgreSQL 协议服务器，调用与生产相同的 pg 驱动、建表脚本、Next.js 生产服务及认证接口。测试数据库在结束后销毁，不连接 Neon。

测试覆盖注册登录、私密隔离、他人审批、禁止自投、一人一票、改变投票、点赞幂等、所有权、跨站请求拦截、提醒保存、撤回，以及应用重启后的登录状态和记录持久性。PGlite 不等同于 Neon 实例，正式上线后仍需验证 TLS、实际数据库和 Render 转发链路。

## 已有产品边界

- 一人一票，不能审批或点赞自己；支持多于反对且至少一票时通过，平票待审批。
- 私密记录仅自己可见；明确发布后，所有已注册用户才能查看和投票。
- 不依赖 ChatGPT 登录；邮箱不向饭友公开。
- 内测暂不提供邮件找回密码、邮件验证、图片上传、独立好友关系或微信推送。
- 提醒是前台网页通知和日历导出；不承诺后台推送。
- 此版本没有导入原托管平台的线上用户数据；若原平台已有真实数据，应另行安排有备份的迁移。

## 复用组件

复用现有 React 界面；Next.js、Better Auth 和 node-postgres 使用 MIT 许可证；Drizzle 和本地测试工具 PGlite / pglite-socket 使用 Apache-2.0。使用标准 PostgreSQL 数据格式，可从 Neon 导出迁移。运行费用受平台免费额度及政策约束。

# HachiCats · 第一届八猫杯

手机优先的太鼓赛事网站，支持管理员编辑选手资料、首轮换人及替补管理，以及三组单败淘汰、两台并行比赛、选曲与 Ban、手动录分、自动晋级、轮空及管理员重置。

- 正式网站：[hachicats.ourtaiko.org](https://hachicats.ourtaiko.org)
- 生产：Next.js / Vercel + MongoDB Atlas，登录使用既有 OurTaiko SSO。
- 维护入口：[维护手册](docs/MAINTENANCE.md)；Codex / 其他代码助手先读 [AGENTS.md](AGENTS.md)。

## 数据和代码在哪里

| 内容 | 位置 |
| --- | --- |
| 页面、对阵图、管理表单 | `app/page.tsx`、`components/` |
| 后端 HTTP 接口 | `app/api/**/route.ts` |
| 比赛规则、晋级与持久化 | `lib/rules.ts`、`lib/tournament.ts`、`lib/store.ts` |
| 选手姓名、初始出场序号、rating | MongoDB `tournaments/edition-1` 的 `body.rosters` |
| 正式曲库与指定曲 | MongoDB `song_libraries`，文档 `edition-1` |
| 正式比分与比赛进度 | MongoDB `tournaments`，文档 `edition-1` |
| 管理员权限 | OurTaiko SSO → Client roles → HachiCats → Is admin |
| 登录会话、重置备份 | MongoDB `sessions`、`tournament_backups`；旧 `admins` 仅留存回退 |

曲名与星级从 OurTaiko 曲目接口获取。未公布的指定曲不进入公开 API 或浏览器代码；真实配置不要提交进 Git。旧 Git 历史曾保存过指定曲，当前移除不代表历史已清除。

## 本地开发

推荐 Node.js 24；项目最低要求 Node.js 22.13。以下命令从本仓库根目录执行，使用独立 SQLite 演示库，不需要生产数据库或 SSO 凭证：

```sh
npm ci
MONGODB_URI='' MONGODB_DB='' VERCEL='' DEMO_MODE=true \
  APP_ORIGIN=http://127.0.0.1:5192 DATABASE_PATH=.data/local-demo.sqlite \
  node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 5192
```

访问 `http://127.0.0.1:5192`，点击「主办方入口 → 体验演示管理模式」。本地库首次自动初始化，曲库为独立样例。`127.0.0.1` 与 `localhost` 不要混用。

原有 `npm run dev` 使用 Vinext 路线，默认端口 5188，配置与 D1 初始化见维护手册；它与上面的 Next.js / SQLite 环境不是同一个数据库。

## 常用验证

```sh
npm test
npm run test:admins
npm run test:storage
npm run test:reset
npm run typecheck
npm run build:server
```

本地演示服务运行时，另外执行：

```sh
TEST_ORIGIN=http://127.0.0.1:5192 npm run test:api
```

按改动范围选择验证；纯文档修改只核对事实、路径、链接与命令，不需要运行应用测试。Atlas 集成测试的使用条件见维护手册。

## 生产更新

GitHub `KirisameVanilla/HachiCats` 的 `main` 分支连接 Vercel 项目 `vanillaaaa/hachicats`。推送后自动构建 `npm run build:server`，前端与后端一起部署。需确认部署 Ready、正式域名对应新版本，再验证公开页面与相关接口。

管理员设置、曲库维护、重置 / 恢复、备份、故障定位和历史迁移工具，都以 [维护手册](docs/MAINTENANCE.md) 为准。

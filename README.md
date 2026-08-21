# PPT 历史图片素材库

面向 PPT 团队的历史配图检索工具。通过主题词、PPT 标题、期数和图片文字快速找图，并显示素材来自哪一期 PPT、哪一页，方便复用历史页面。

## 当前数据范围

- 公募直播 PPT
- 私募直播 PPT
- 对外演讲 PPT
- 已排除学院素材，以及封面页、总结页等不需要复用的页面
- 当前权威库可导出 8,076 张历史 PPT 页面和 11,286 条分类标签（以每次导出结果为准）

## 当前部署结构

- `src/`、`app/LibraryExplorer.tsx`：Vite + React 前端
- `cloud-functions/api/`：EdgeOne Node.js API
- `supabase/schema.sql`：PostgreSQL 表、索引和检索函数
- `scripts/export_catalog.py`：只读导出 Supabase CSV 和 COS 上传清单
- `tests/`：基本构建与页面测试

生产架构为 EdgeOne Makers + Supabase + 腾讯云 COS。仓库已移除 OpenAI Sites、Cloudflare D1/R2、Wrangler 和 vinext 运行依赖。

## 为什么仓库里没有全部原图

历史图片体积较大，并且属于内部业务资料，不适合直接提交到 GitHub。即使本仓库是私有仓库，也应把程序、结构化数据和图片分开保存：

- GitHub 仓库：程序代码（建议恢复为私有）
- 云端数据库：分类、OCR、PPT 期数与页码
- 私有对象存储：7,827 张图片

正式部署时在 EdgeOne 服务端配置 Supabase 和 COS 环境变量。网页通过 Cloud Functions 读取数据和生成 5 分钟 COS 签名地址，不把密钥或原图公开在代码仓库中。

## 本地运行

要求 Node.js `>=20`。

```bash
npm install
npm run dev
```

构建与检查：

```bash
npm run build
npm test
```

## 数据更新

本地素材库的当前来源目录为：

```text
/Users/fanlili/Desktop/范丽丽./图片素材库
```

新增或修正素材后：

1. 在本地素材库更新 SQLite 目录和图片。
2. 运行 `python3 scripts/export_catalog.py` 导出 CSV 和 COS 清单（写入被 Git 忽略的 `exports/`）。
3. 将新增图片同步到 COS，并将结构化记录增量导入 Supabase。
4. 检查期数、页码、OCR 和分类。仅数据变化时无需重新部署网页。

不要把 `.env`、访问令牌、数据库密码、上传凭证或整套原图提交到仓库。

## 团队部署

详细操作请查看 [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md)。

建议由公司部署负责人把本仓库接入腾讯 EdgeOne，并配置：

- Supabase 服务端连接
- COS 私有存储读取凭证
- 公司域名
- 飞书登录或公司内部访问白名单

这样同事通过统一网址使用，维护人员通过 GitHub 协作更新程序。

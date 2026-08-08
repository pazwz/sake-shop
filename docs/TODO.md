# 🍶 酒类 EC 网站开发 TODO

> Last Update: 2026-08-02

---

# 项目目标

建立一个面向日本市场的高端酒类 EC 网站。

目前阶段：

- 前台 Demo（Next.js + Vercel）
- 后续逐步开发正式版
- 后台管理系统
- 数据库
- 支付
- スマレジ联动

---

# 已完成

## 基础环境

- [x] Next.js
- [x] GitHub
- [x] Vercel 自动部署
- [x] 本地开发环境
- [x] Codex 工作流

---

## Demo

- [x] 首页
- [x] 商品分类
- [x] 商品详情
- [x] Cart
- [x] Checkout
- [x] 模拟信用卡支付
- [x] 模拟 PayPay

---

## 第一版 UI

- [x] 白色高级风
- [x] Mega Menu
- [x] Hero
- [x] 四季推荐
- [x] 店主推荐
- [x] Footer
- [x] Newsletter
- [x] Favicon

---

# Sprint 1

## Demo UI 优化

### 首页

- [ ] Hero 再优化
- [ ] 图片质量统一
- [ ] Typography 优化
- [ ] 首页节奏优化
- [ ] 商品数量减少
- [ ] 更多留白

---

### 商品

- [ ] 商品图片统一比例
- [ ] 商品详情优化
- [ ] 商品推荐优化

---

### UX

- [ ] Search 优化
- [ ] Skeleton
- [ ] Loading
- [ ] Toast
- [ ] Empty State

---

# Sprint 2

# 数据库设计（重要）

暂时不开发后台。

先设计数据库。

建议：

PostgreSQL

---

## 商品

- [ ] Categories
- [ ] Products
- [ ] Product Images
- [ ] Inventory

---

## 首页内容

未来后台编辑：

- [ ] Featured Collections

例如：

- 春
- 夏
- 秋
- 冬
- 店主推荐
- 九州特集
- Gift
- Story

---

## 特辑商品关联

- [ ] Featured Collection Products

---

## Customer

- [ ] Customers

- [ ] Address

---

## Order

- [ ] Orders

- [ ] Order Items

- [ ] Payments

- [ ] Shipments

---

## Admin

- [ ] Admin Users

- [ ] Roles

- [ ] Permissions

- [ ] Audit Logs

---

# Sprint 3

# 图片存储

推荐：

AWS S3

（也可以后续评估 Cloudflare R2）

---

需要存储：

- [ ] 商品图片
- [ ] Banner
- [ ] Hero
- [ ] 四季图片
- [ ] 店铺图片
- [ ] 快递附件

数据库只保存：

- URL
- FileName
- MimeType
- Size
- CreatedAt

---

# Sprint 4

# 管理后台

客户以后不需要改代码。

---

Dashboard

- [ ] 今日订单
- [ ] 今日销售
- [ ] 未发货
- [ ] 库存提醒

---

首页内容管理

客户可以：

- [ ] 换首页 Hero

- [ ] 改标题

- [ ] 改副标题

- [ ] 改介绍

- [ ] 上传图片

- [ ] 调整顺序

- [ ] 发布

- [ ] 下架

---

专题推荐

客户可以：

- [ ] 春

- [ ] 夏

- [ ] 秋

- [ ] 冬

- [ ] 店主推荐

- [ ] Gift

- [ ] 九州特集

- [ ] Story

每个专题：

- 图片

- 标题

- 文案

- 商品

- 发布时间

- 排序

---

商品管理

- [ ] 商品新增

- [ ] 商品编辑

- [ ] 商品图片

- [ ] 分类

- [ ] 上架

- [ ] 下架

- [ ] 库存

---

订单管理

- [ ] 查看订单

- [ ] 修改订单状态

- [ ] 查看支付状态

- [ ] 查看配送信息

---

发货

- [ ] 快递公司

- [ ] 运单号

- [ ] 上传附件

- [ ] 发货通知

---

权限

- [ ] Owner

- [ ] Manager

- [ ] Staff

---

# Sprint 5

# 支付

等待客户决定。

候选：

- [ ] stera EC

或者

- [ ] Stripe

需要：

- [ ] Credit Card

- [ ] PayPay

- [ ] Webhook

- [ ] Payment Status

---

# Sprint 6

# スマレジ

客户：

✅ 已使用スマレジ

下一步确认：

- [ ] API 是否开放

- [ ] 使用套餐

- [ ] API Key

- [ ] Platform API

---

如果可以接入：

商品：

スマレジ

↓

Website

库存：

スマレジ

↓

Website

订单：

Website

↓

スマレジ

---

需要确认：

- [ ] 商品同步

- [ ] 库存同步

- [ ] 订单同步

- [ ] 顾客同步

---

# Sprint 7

# 正式上线

- [ ] 域名

- [ ] SSL

- [ ] Production Database

- [ ] Backup

- [ ] Monitoring

- [ ] Email

- [ ] 正式支付

---

# 客户待确认

## 支付

- [ ] stera 是否有 EC

---

## スマレジ

- [ ] API

- [ ] 套餐

- [ ] 是否同步库存

---

## 配送

- [ ] 配送公司

- [ ] 运费

- [ ] 冷藏

---

## SNS

- [ ] Instagram

- [ ] LINE

- [ ] Facebook

- [ ] YouTube

---

## 图片

- [ ] Logo

- [ ] 商品图片

- [ ] 店铺图片

- [ ] Banner

---

# 已确认

客户：

✅ 有实体店

✅ 使用スマレジ

✅ 使用 stera

✅ 已取得

通信販売酒類小売業免許

---

# 后续开发原则

1.

不要硬编码首页。

所有：

- Banner
- Hero
- 四季推荐
- 店主推荐
- Gift
- Story

都应由后台管理。

---

2.

不要把图片存数据库。

统一：

Object Storage

数据库只保存 URL。

---

3.

Website 为展示层。

后台负责：

- 内容
- 商品
- 订单
- 发货

---

4.

如果スマレジ API 可以使用：

优先让スマレジ成为：

商品

库存

主数据。

网站负责：

EC

订单

专题

支付

配送。

---

5.

数据库设计完成后，再开发后台。

避免后期大量修改 Schema。



# Sprint 2 - 架构设计 TODO

## 一、スマレジ Platform API 对接（最高优先级）

### 已确认

- [x] 客户使用スマレジ
- [x] 套餐：リテールビジネス
- [x] 实体店与网站共用库存
- [x] 使用佐川配送
- [x] 已取得「通信販売酒類小売業免許」

### 待确认

- [ ] Platform API 是否已开通
- [ ] 是否可以申请 API Key（Client ID / Client Secret）
- [ ] 是否开放 Webhook
- [ ] EC 支付最终采用 stera EC 还是其他方案

---

## 二、数据库设计

开始正式数据库设计。

预计建立：

- Products
- Categories
- ProductImages
- Orders
- OrderItems
- Customers
- Addresses
- Payments
- Shipments
- Features（专题推荐）
- FeatureProducts
- Seasons（四季专题推荐）
- Newsletters
- AdminUsers

---

## 三、数据主导关系（Master Data）

确定系统职责：

### スマレジ负责

- 商品
- 商品价格
- 库存
- POS 销售

### 网站负责

- 首页内容
- Hero Banner
- 四季推荐
- 专题
- 顾客
- Newsletter
- 在线订单
- 配送状态
- 网站后台

---

## 四、同步设计

设计同步流程：

スマレジ
↓

商品同步

↓

网站数据库

↓

用户浏览

网站订单

↓

同步至スマレジ

↓

库存同步

↓

网站库存更新

支持：

- API
- Webhook

设计失败重试机制。

---

## 五、后台管理系统

新增管理后台：

### 商品管理

- 商品同步
- 商品状态
- 商品图片

### 专题管理

- Hero Banner
- 季节推荐
- 推荐商品
- 店长推荐

### 订单管理

- 查看订单
- 修改状态
- 输入物流单号
- 发货完成

### 会员管理

### Newsletter 管理

---

## 六、物流

等待客户确认：

- 运费规则
- 是否冷藏配送
- 包装尺寸规则
- 佐川合同价

---

## 七、支付

等待确认：

- stera EC
- API
- 支付成功回调
- 支付状态同步

---

## 八、系统优化

数据库建成后：

- 去除 Mock Data
- 全部改为数据库读取
- 图片改对象存储（AWS S3）
- 后台全部动态化

---

## 九、文档

新增：

- スマレジ API 对接设计书
- 数据库 ER 图
- API 一览
- 系统架构图
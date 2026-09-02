# 酒类 EC 项目 API 设计规范

Version: 1.0

Last Update: 2026-08-14

---

# 一、API 设计原则

## 1. RESTful API

统一采用 RESTful 风格。

例如：

GET

POST

PATCH

DELETE

禁止：

RPC 风格接口。

---

## 2. 返回格式统一

所有接口统一返回：

```json
{
  "success": true,
  "data": {},
  "message": "",
  "error": null
}
```

错误：

```json
{
  "success": false,
  "data": null,
  "message": "",
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "detail": "Product not found."
  }
}
```

---

## 3. HTTP Status

200 OK

201 Created

204 No Content

400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Validation Error

500 Internal Server Error

---

## 4. API Version

统一：

/api/v1/

例如：

/api/v1/products

方便以后升级。

---

# 二、Frontend API

---

## 首页

### 获取首页

GET

/api/v1/home

返回：

- Hero
- Banner
- 四季推荐
- 推荐商品
- 最新商品
- 店长推荐

---

## 商品

### 商品列表

GET

/api/v1/products

支持：

page

limit

category

subcategory

keyword

season

sort

返回：

商品分页列表

---

### 商品详情

GET

/api/v1/products/{id}

返回：

商品详细资料

图片

库存

推荐商品

---

### 搜索

GET

/api/v1/search

参数：

keyword

返回：

商品

分类

专题推荐

---

## 分类

### 分类列表

GET

/api/v1/categories

返回：

树形分类。

例如：

日本酒

↓

纯米

↓

纯米吟酿

---

## 购物车

### 获取购物车

GET

/api/v1/cart

---

### 添加商品

POST

/api/v1/cart

---

### 修改数量

PATCH

/api/v1/cart

---

### 删除商品

DELETE

/api/v1/cart/{itemId}

---

## Checkout

### 创建结算

POST

/api/v1/checkout

功能：

计算：

商品金额

运费

税

优惠

总金额

---

## 订单

### 创建订单

POST

/api/v1/orders

订单创建会在单一数据库 transaction 内对全部 Product 按稳定顺序加行锁，校验：

```text
availableQuantity = max(0, approvedPhysicalTotal - activeReservedQuantity)
```

库存充足时同时创建 Order、OrderItem 和 ACTIVE InventoryReservation。任一商品不足时
返回 `INSUFFICIENT_INVENTORY`，整单不创建。响应中的每个 OrderItem 包含
`requiresTransfer`；Store `1` 的保守可履约量不足时为 true。

订单创建不会修改 Smaregi inventory，也不会自动调拨。

---

### 我的订单

GET

/api/v1/orders

---

### 订单详情

GET

/api/v1/orders/{id}

---

### 取消订单

PATCH

/api/v1/orders/{id}/cancel

---

## 用户

### 登录

POST

/api/v1/auth/login

---

### 注册

POST

/api/v1/auth/register

---

### 登出

POST

/api/v1/auth/logout

---

### 我的资料

GET

/api/v1/profile

---

### 修改资料

PATCH

/api/v1/profile

---

# 三、Admin API

所有接口：

需要登录。

Role：

OWNER

MANAGER

STAFF

---

## 管理员认证

### 登录

POST

/api/v1/admin/auth/login

Request：

```json
{
  "username": "admin_linxas",
  "password": "********"
}
```

正式后台使用 username 作为登录 ID。过渡期间，包含 `@` 的登录 ID 可以按
现有 email 查询，以保证历史管理员账号继续可用。

---

## 管理员媒体上传

### S3 直传准备

POST

/api/v1/admin/media/presign

Role：OWNER / MANAGER

Request：

```json
{
  "fileName": "collection.jpg",
  "contentType": "image/jpeg",
  "fileSize": 9437184
}
```

`contentType` 必须为 `image/*`，`fileSize` 必须大于 0 且不超过 10 MB。
对象 key 由服务器按 `uploads/yyyy/mm/uuid-filename` 生成，客户端不能指定
Bucket 或 key。返回的 S3 PUT URL 有效期为 5 分钟。

Response data：

```json
{
  "uploadUrl": "https://signed-s3-url",
  "key": "uploads/2026/08/uuid-collection.jpg",
  "url": "https://cloudfront-domain/uploads/2026/08/uuid-collection.jpg"
}
```

浏览器使用相同 `Content-Type` 直接 PUT 到 S3。图片二进制不经过本 API 或
Vercel Function。旧 multipart media upload Route 不再使用。

---

## Dashboard

GET

/api/v1/admin/dashboard

返回：

订单数量

销售额

库存预警

最新订单

---

## 商品

### 商品列表

GET

/api/v1/admin/products

---

### 商品详情

GET

/api/v1/admin/products/{id}

---

### EC字段修改

PATCH

/api/v1/admin/products/{id}

允许：

描述

推荐

上下架

图片

禁止：

Smaregi 商品编码

库存

价格

---

### 商品图片

POST

/api/v1/admin/products/{id}/images

DELETE

/api/v1/admin/products/{id}/images/{imageId}

---

## 首页 Hero

GET

/api/v1/admin/home/hero

PATCH

/api/v1/admin/home/hero

---

## Banner

GET

/api/v1/admin/banners

POST

/api/v1/admin/banners

PATCH

/api/v1/admin/banners/{id}

DELETE

/api/v1/admin/banners/{id}

---

## 四季推荐

GET

/api/v1/admin/seasons

POST

/api/v1/admin/seasons

PATCH

/api/v1/admin/seasons/{id}

DELETE

/api/v1/admin/seasons/{id}

---

## 专题

GET

/api/v1/admin/collections

POST

/api/v1/admin/collections

PATCH

/api/v1/admin/collections/{id}

DELETE

/api/v1/admin/collections/{id}

---

## 推荐商品排序

PATCH

/api/v1/admin/collections/{id}/products/order

---

## Editorial 文章段落

GET

/api/v1/admin/collections/{id}/editorial-sections

PUT

/api/v1/admin/collections/{id}/editorial-sections

PUT 使用固定字段的有序 Section 数组整体保存：

- id（既有 Section 更新时）
- title
- body
- imageUrl（任意）
- productId（任意；每段最多一个）

权限：

- OWNER / MANAGER：读取与保存
- STAFF：只读
- 未登录：401

该 API 仅允许父 Collection 类型为 EDITORIAL。Section 商品关联不修改 FeaturedCollectionProduct。

---

## 订单

### 所有订单

GET

/api/v1/admin/orders

支持：

分页

订单号

客户

日期

状态

---

### 订单详情

GET

/api/v1/admin/orders/{id}

---

### 修改订单状态

PATCH

/api/v1/admin/orders/{id}

订单详情中的 OrderItem 返回 `requiresTransfer`。Reservation release / consume 由
Service 提供幂等基础操作；支付超时和订单状态自动接线不在本阶段范围内。

---

## 发货

PATCH

/api/v1/admin/orders/{id}/shipment

内容：

物流公司

运单号

发货日期

状态

---

## Newsletter

GET

/api/v1/admin/newsletters

DELETE

/api/v1/admin/newsletters/{id}

---

## 后台账号

GET

/api/v1/admin/users

POST

/api/v1/admin/users

PATCH

/api/v1/admin/users/{id}

DELETE

/api/v1/admin/users/{id}

---

## 操作日志

GET

/api/v1/admin/audit-logs

---

# 四、支付 API

统一：

Payment Provider Adapter

支持：

STERA

PAYPAY

STRIPE

---

创建支付

POST

/api/v1/payments/create

Supports an optional `idempotencyKey`. Repeated requests with the same key
return the existing Payment; the server always derives the amount from the
Order.

---

支付成功回调

POST

/api/v1/payments/webhook

Webhook requests identify the provider, provider payment ID, and provider event
ID. Signature verification is delegated to the provider adapter. The endpoint
stores a unique provider/event record before applying Payment and Order status
changes, so duplicate deliveries return success without reprocessing.

---

取消支付

POST

/api/v1/payments/cancel

---

退款

POST

/api/v1/payments/refund

---

# 五、Smaregi Integration API

## 利用者契約通知

POST

/api/v1/integrations/smaregi/contract

Smaregi Developers の「利用者契約通知先URL」専用の受信エンドポイント。

Request headers：

- `Content-Type: application/json`
- `Smaregi-Contract-Id`: 通知対象の契約ID
- `Smaregi-Event: AppSubscription`

Request body：

- `event`: `AppSubscription`
- `action`: `start` / `end` / `change-plan` / `change-options` / `force-stop` / `cancel-force-stop`
- `date`: `yyyy-mm-dd`
- `contractId`: Header の契約IDと一致すること
- `clientId`
- `plan`
- `options`

正常な通知は必要最小限の非機密情報だけを SyncLog に記録し、3秒以内に空の
response body で HTTP 200 を返す。不正な JSON、Header、payload、または契約ID
の不一致は HTTP 400 を返す。

このエンドポイントはアクセストークンを発行せず、Smaregi API を呼び出さず、
商品・カテゴリ・在庫・注文データを変更しない。

---

## Read-only dry-run

Smaregi 同步预演当前只作为 Service-level 功能，不提供公开 API。
它使用 OAuth client credentials 自动取得短期 Access Token，并在同一
server-side client instance 内缓存 Token。Token 和凭证不进入响应或日志。

Read scope 限定为：

- `pos.stores:read`
- `pos.products:read`
- `pos.stock:read`
- `pos.transactions:read`
- `pos.suppliers:read`

Smaregi 输入：Stores、Categories、Products、Stock。Neon 输入：
Category、Product、InventoryMirror 的必要字段。Repository 只执行
`findMany`，dry-run 不写入 Neon 或 SyncLog。

输出分组：

- categories: `toCreate` / `toUpdate` / `unchanged` / `toDeactivate`
- products: `toCreate` / `toUpdate` / `unchanged` / `toDeactivate`
- inventory: `toCreate` / `toUpdate` / `toZero` / `unchanged`
- storesUsed: 固定批准 Store `1` / `2` / `3` / `6` 中实际存在的 Store
- anomalies: orphan Stock、negative Stock、缺失的批准 Store

差异只包含 Smaregi ID、商品代码、字段名和 before/after 值，
不返回完整数据库对象。

Product dry-run 同时返回 `taxDivision`、`resolvedTaxRate`、
`priceMeaning` 和 `taxResolutionSource`。标准税率来自
`consumption_tax_rates`，轻减税率来自 `reduce_tax_rates`。
不允许固定税率或 silent fallback。

Category 税区分为 null 且 Product 使用 Category 税设置时，Product 以
`CATEGORY_TAX_DIVISION_MISSING` 标记 blocked。客户明确批准暂缓的 6 个箱代金
Product 在原因完全一致时单独进入 `approvedDeferredProducts`，不进入 Product 或
InventoryMirror write plan，也不计入未知 blocker；其他税异常继续 fail closed。
orphan Stock 不进入 inventory plan；negative Stock 保留 raw quantity 并进入 warning，
不能静默改写为 0。

箱代金 Product 不因 `isEcAvailable=false` 从同步输入移除。税率可解析时仍同步
Product、价格与每店库存；税率不可解析时继续 blocked。新 Product 默认
`isEcAvailable=false`，不会因同步自动公开。

获批的同步 plan 只能在 Service 完成所有 GET 和验证后交给单一
Prisma transaction。当前不提供触发该原子写入的公开 API。

---

网站调用：

商品同步

POST

/api/v1/system/sync/products

---

库存同步

POST

/api/v1/system/sync/inventory

---

价格同步

POST

/api/v1/system/sync/prices

---

订单同步

POST

/api/v1/system/sync/orders

---

顾客同步（预留）

POST

/api/v1/system/sync/customers

---

# 六、Webhook

## Payment

支付成功

↓

订单更新

↓

库存检查

↓

同步 Smaregi

---

## Smaregi

商品更新

↓

Website

---

库存变化

↓

Website

---

价格变化

↓

Website

---

# 七、权限

游客：

商品

分类

首页

搜索

---

会员：

购物车

下单

订单

个人资料

---

STAFF：

订单

发货

---

MANAGER：

商品

专题

订单

发货

---

OWNER：

全部权限

---

# 八、安全

JWT Authentication

HTTPS

CSRF Protection

Rate Limit

Request Validation

SQL Injection Protection

XSS Protection

文件上传限制

API Audit Log

---

# 九、开发规范

所有接口：

必须：

Server Action

或

Route Handler

统一：

TypeScript

统一：

Zod Validation

统一：

Prisma

统一：

Repository Pattern

统一：

Service Layer

禁止：

Route 中直接操作数据库。

---

# 十、开发顺序

Sprint 1

Products API

Categories API

---

Sprint 2

Orders API

Payments API

---

Sprint 3

Shipment API

Admin API

---

Sprint 4

Smaregi Integration

---

Sprint 5

Payment Integration

---

---

# Database Health API

## GET /api/v1/health/database

用途：

用于开发、部署及监控过程中确认应用是否能够正常连接 PostgreSQL。

该接口不用于业务处理。

### Authentication

当前开发阶段允许公开访问。

正式生产环境后，可根据监控方案决定是否限制访问。

### Success Response

HTTP 200

```json
{
  "success": true,
  "data": {
    "database": "connected",
    "timestamp": "2026-08-09T00:00:00.000Z",
    "version": "v1"
  },
  "message": "",
  "error": null
}
本文件作为整个项目 API 开发唯一标准，所有后续开发必须遵循本规范。
```

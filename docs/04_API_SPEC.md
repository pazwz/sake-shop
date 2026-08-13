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

# 酒类 EC 系统架构

Version: 1.0

Last Update: 2026-08-08

---

# 一、总体架构

                    Customer
                        │
                        ▼
               Next.js EC Website
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   PostgreSQL         Object Storage   Payment
        │               │                │
        └───────────────┼────────────────┘
                        │
                        ▼
                 Smaregi Platform API
                        │
                        ▼
                    Smaregi POS

---

# 二、系统组成

## Frontend

Next.js

TypeScript

TailwindCSS

---

## Backend

Next.js Route Handler

Server Actions

REST API

---

## Database

PostgreSQL

---

## Storage

AWS S3

未来：

商品图片

Hero

Banner

专题推荐

运单附件

---

## Payment

待确认：

stera EC

备用：

Stripe

PayPay

---

## POS

スマレジ

Platform API

---

# 三、主数据

## スマレジ负责

商品

价格

库存

门店销售

---

## 网站负责

首页

专题推荐

四季推荐

商品图片

顾客

订单

支付

配送

后台

---

# 四、数据流

商品

Smaregi

↓

Website DB

↓

Frontend

---

库存

Smaregi

↓

Website

↓

Checkout

---

订单

Website

↓

Payment

↓

Website DB

↓

Smaregi

---

配送

Website Admin

↓

Shipment

↓

Smaregi（可选）

---

# 五、后台

Admin

↓

Products

Collections

Orders

Shipments

Members

Settings

---

# 六、同步

Smaregi

↓

Platform API

↓

Website

↓

Database

---

Webhook

↓

同步库存

↓

同步价格

↓

同步商品

---

# 七、权限

Owner

↓

全部权限

Manager

↓

商品

订单

专题

Staff

↓

订单

发货

---

# 八、部署

Development

↓

Vercel

Production

↓

AWS

---

# 九、开发原则

1.

Smaregi

=

商品主数据

2.

Website

=

EC 主数据

3.

图片

=

S3

4.

所有业务

=

数据库

5.

后台

=

动态管理

禁止硬编码
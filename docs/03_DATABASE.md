# 酒类 EC 系统数据库设计

Version: 1.0

Last Update: 2026-08-08

---

# 一、设计原则

## 主数据原则

### スマレジ负责

- 商品
- 分类
- 价格
- 库存
- POS销售

网站不允许维护第二套商品数据。

网站数据库保存的是：

**Smaregi Mirror（镜像数据）**

---

### Website负责

网站负责所有 EC 业务。

包括：

- 首页
- Hero
- Banner
- 四季推荐
- 专题
- 商品图片
- 商品说明
- 顾客
- 地址
- 订单
- 支付
- 发货
- 后台
- Newsletter

---

# 二、数据库列表

| Table | 用途 |
|---------|-------------------------|
| categories | 商品分类 |
| products | 商品镜像 |
| product_images | 商品图片 |
| inventory_mirror | 库存镜像 |
| customers | 顾客 |
| customer_addresses | 收货地址 |
| orders | 订单 |
| order_items | 订单商品 |
| payments | 支付 |
| shipments | 配送 |
| featured_collections | 专题 |
| featured_collection_products | 专题商品 |
| admin_users | 后台用户 |
| audit_logs | 操作日志 |
| sync_logs | API同步日志 |

---

# 三、数据关系

Category

↓

Product

↓

ProductImage

↓

InventoryMirror

---

Customer

↓

Address

↓

Order

↓

OrderItem

↓

Payment

↓

Shipment

---

FeaturedCollection

↓

FeaturedCollectionProduct

↓

Product

---

AdminUser

↓

AuditLog

---

SyncLog

---

# 四、Table Design

---

## categories

用途：

商品分类。

支持无限级分类。

例如：

日本酒

↓

纯米酒

↓

纯米吟酿

字段：

id

smaregi_category_id

parent_id

name

slug

display_order

is_active

created_at

updated_at

Index

smaregi_category_id

parent_id

slug

---

## products

用途：

商品镜像。

Smaregi

↓

同步

↓

Website

字段：

id

smaregi_product_id

category_id

product_code

jan_code

name

slug

price

tax_rate

producer

origin

volume

alcohol_percentage

description

tasting_notes

is_active

is_ec_available

last_synced_at

created_at

updated_at

Index

smaregi_product_id

product_code

category_id

slug

---

## product_images

用途：

商品图片。

图片存放：

AWS S3

数据库保存URL。

字段：

id

product_id

image_url

image_type

display_order

alt_text

created_at

---

## inventory_mirror

用途：

库存镜像。

不作为库存主数据。

字段：

id

product_id

smaregi_store_id

quantity

reserved_quantity

available_quantity

last_synced_at

created_at

updated_at

---

## customers

用途：

EC会员。

字段：

id

email

password_hash

name

name_kana

phone

birthday

age_confirmed

smaregi_customer_id

created_at

updated_at

Unique

email

---

## customer_addresses

用途：

收货地址。

支持多个地址。

字段：

id

customer_id

postal_code

prefecture

city

address1

address2

recipient_name

phone

is_default

created_at

updated_at

---

## orders

用途：

订单。

字段：

id

order_number

customer_id

status

payment_status

shipment_status

subtotal

shipping_fee

tax_amount

discount_amount

total_amount

payment_method

shipping_address_snapshot

smaregi_order_id

smaregi_sync_status

ordered_at

created_at

updated_at

Index

order_number

customer_id

status

---

## order_items

用途：

订单商品。

保存商品快照。

字段：

id

order_id

product_id

product_name

product_code

unit_price

quantity

tax_rate

subtotal

created_at

---

## payments

用途：

支付。

字段：

id

order_id

provider

provider_payment_id

status

amount

paid_at

failed_at

cancelled_at

created_at

updated_at

Provider

STERA

PAYPAY

STRIPE

---

## shipments

用途：

配送。

字段：

id

order_id

carrier

tracking_number

shipping_method

status

label_file_url

shipped_at

delivered_at

created_at

updated_at

Carrier

SAGAWA

YAMATO

JP_POST

---

## featured_collections

用途：

首页专题。

统一管理：

Hero

Banner

四季推荐

店长推荐

Gift

Story

字段：

id

type

season

title

subtitle

description

desktop_image_url

mobile_image_url

status

publish_start_at

publish_end_at

display_order

created_by

created_at

updated_at

Type

HERO

SEASONAL

SHOPKEEPER

GIFT

EDITORIAL

Season

SPRING

SUMMER

AUTUMN

WINTER

---

## featured_collection_products

用途：

专题推荐商品。

字段：

id

featured_collection_id

product_id

display_order

created_at

---

## admin_users

用途：

后台账号。

字段：

id

email

password_hash

Current database design allows this field to be nullable. A null value means
the administrator has not set a password and must be denied password login.

name

role

is_active

last_login_at

created_at

updated_at

Role

OWNER

MANAGER

STAFF

---

## audit_logs

用途：

后台操作日志。

字段：

id

admin_user_id

action

entity_type

entity_id

before_data

after_data

ip_address

created_at

---

## sync_logs

用途：

Smaregi同步日志。

字段：

id

system

entity_type

entity_id

direction

action

status

request_payload

response_payload

error_message

retry_count

started_at

completed_at

created_at

Direction

SMAREGI_TO_WEBSITE

WEBSITE_TO_SMAREGI

Status

SUCCESS

FAILED

RETRY

---

# 五、数据库约束

所有表：

必须包含：

created_at

updated_at

所有删除：

原则：

Soft Delete

禁止物理删除。

---

# 六、图片策略

数据库：

只保存URL。

图片统一保存在：

AWS S3

包括：

商品图片

Hero

Banner

专题推荐

后台上传图片

物流附件

---

# 七、同步原则

Smaregi

↓

Platform API

↓

Website Database

↓

Frontend

订单：

Website

↓

Database

↓

Smaregi

库存：

以Smaregi为准。

网站不得修改库存。

---

# 八、未来扩展

支持：

优惠券

积分

礼品卡

会员等级

预约商品

预售商品

多门店

多语言

海外配送

OMS

CRM

BI分析

全部兼容当前数据库设计。

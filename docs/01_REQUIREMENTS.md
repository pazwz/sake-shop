# 酒类 EC 项目 - 客户需求（Requirements）

Version: 1.0

Last Update: 2026-08-08

---

# 一、项目目标

开发一套面向日本市场的高端酒类 EC 网站。

定位：

- 高端
- 简洁
- 编辑风格（Editorial）
- 白色基调
- 后续支持后台管理
- 支持实体店 + EC 一体化

---

# 二、已确认事项

## 1. 店铺

✅ 已有实体店

---

## 2. 酒类销售资格

✅ 已取得

通信販売酒類小売業免許

---

## 3. POS

使用：

スマレジ

套餐：

リテールビジネス

---

## 4. 库存

客户希望：

实体店

+

EC

共用库存

---

## 5. 支付

客户：

线下：

stera / PAYGATE

线上：

等待银行确认

预计：

stera EC

---

## 6. 配送

物流：

佐川

运费：

不包邮

---

## 7. SNS

目前：

Instagram

小红书

---

# 三、网站功能

## 前台

首页

商品分类

商品详情

购物车

Checkout

会员

订单查询

搜索

---

## 商品

### Admin 商品管理

后台商品列表必须同时显示 Smaregi 同步商品与既有商品，并支持商品名、商品代码、
Smaregi Product ID、Category、EC 公開状态及数据来源筛选。默认每页 25 件。

Smaregi 管理的商品名、商品代码、Category、价格、有效状态、同步时间和四店库存为
只读。LINXAS Admin 只可编辑 slug、商品说明、tasting notes、生产者、产地、容量、
酒精度、商品图片和 EC 公開状态。OWNER / MANAGER 可修改；STAFF 只可查看列表。

非公開商品只有在 Smaregi 商品有效、价格大于 0、slug 合法且唯一、至少有一张图片、
且同步来源有效时才可公开。说明和库存为 0 只显示 warning，不阻止公开。

公开商品查询、搜索、直接详情、首页及 Collection 均必须同时满足
`isActive=true` 与 `isEcAvailable=true`。

支持：

大分类

↓

小分类

例如：

日本酒

↓

纯米

↓

纯米吟酿

↓

大吟酿

---

## 首页

客户要求：

Hero

四季推荐

专题推荐

店主推荐

Gift

Story

---

## 四季

Spring

Summer

Autumn

Winter

每个季节：

独立图片

独立文案

独立商品

后台可修改。

---

## Footer

包含：

Customer Support

Newsletter

Follow Us

---

Newsletter

按钮

↓

登录

↓

注册

Demo

---

# 四、后台

客户可管理：

Hero

专题推荐

四季推荐

Banner

商品推荐

图片

文字

排序

上下架

---

订单

查看

发货

运单号

状态

---

商品

同步

图片

分类

库存查看

---

# 五、支付

计划：

信用卡

PayPay

stera EC（待确认）

---

# 六、スマレジ

计划：

商品同步

库存同步

订单同步（待确认）

价格同步

Production 商品・Category・四店库存必须支持每 15 分钟的增量同步及 OWNER / MANAGER
手动立即同步。两个入口共用同一全局锁、异常分类、原子写入与 SyncLog；Smaregi
始终只读。单商品税/负库存异常隔离，source identity、Store 集合、全局税率或 plan
不一致时整批停止。新增商品默认 `isEcAvailable=false`，既有 LINXAS-owned 字段不得覆盖。
定时调用由外部 Scheduler 经受保护的 internal endpoint 触发；Vercel Hobby 本身不配置
Cron。AWS EventBridge Scheduler / Lambda 属于后续独立部署范围。

---

# 七、对象存储

商品图片

Banner

Hero

专题推荐图片

运单附件

统一对象存储。

---

# 八、后续

AWS

数据库

后台

支付

正式上线

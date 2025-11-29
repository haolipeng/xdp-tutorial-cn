---
layout: home

hero:
  name: "XDP 教程"
  text: "中文翻译版"
  tagline: 高性能可编程数据包处理实战教程
  actions:
    - theme: brand
      text: 开始学习
      link: /basic01-xdp-pass/
    - theme: alt
      text: 安装依赖
      link: /setup_dependencies

features:
  - title: 基础教程
    details: 学习如何编译、加载和检查 eBPF 程序，掌握 XDP 的基本概念和工具链
  - title: 数据包处理
    details: 深入学习数据包解析、重写和重定向，理解 XDP 的核心数据包处理能力
  - title: 追踪调试
    details: 掌握 XDP 程序的追踪和调试技术，学会使用各种调试工具
  - title: 高级主题
    details: 探索 XDP 与 TC 交互、AF_XDP 等高级功能
---

## 关于本教程

本仓库包含一个教程，旨在向你介绍有效编写 Linux 内核中 eXpress Data Path（XDP）系统程序所需的基本步骤。XDP 提供与内核集成的高性能可编程数据包处理能力。

## 什么是 XDP？

XDP 是上游 Linux 内核的一部分，使用户能够将数据包处理程序安装到内核中，这些程序将在内核对数据进行任何其他处理之前，针对每个到达的数据包执行。程序使用受限的 C 语言编写，并编译成 eBPF 字节码格式，在经过安全验证后在内核中执行并进行 JIT 编译。

有关 XDP 的一般介绍，请阅读 [学术论文 (pdf)](https://github.com/xdp-project/xdp-paper/blob/master/xdp-the-express-data-path.pdf) 或 [Cilium BPF 参考指南](https://cilium.readthedocs.io/en/latest/bpf/)。

## 课程组织方式

本教程分为多个课程，按类别分组：

- **基础设置**（basic01-04）：学习编译、加载和管理 BPF 程序
- **数据包处理**（packet01-03）：学习解析、重写和重定向数据包
- **追踪调试**（tracing01-04）：学习调试和监控 XDP 程序
- **高级主题**（advanced01, 03）：探索 XDP 与 TC 交互、AF_XDP 等

我们建议你从 "basic" 课程开始，并按数字顺序学习每个类别中的课程。

## 快速开始

1. 首先阅读 [安装依赖](/setup_dependencies) 指南
2. 设置 [测试环境](/testenv/)
3. 从 [Basic01 - 加载第一个 BPF 程序](/basic01-xdp-pass/) 开始学习

## 致谢

本教程翻译自 [xdp-project/xdp-tutorial](https://github.com/xdp-project/xdp-tutorial)，感谢原作者的贡献。

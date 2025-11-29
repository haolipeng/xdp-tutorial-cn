# 高级：通过 AF_XDP 实现 XDP 用户空间传递


重要的是要理解 XDP 本身不是内核旁路功能。XDP 是一个 **内核内** 快速路径，
在原始帧到达正常 Linux 内核网络堆栈之前"内联"操作它们。

为了支持将 /原始帧快速传递到用户空间/，XDP 可以通过 XDP_REDIRECT
到包含 AF_XDP 套接字的特殊 BPF 映射来 **绕过** Linux 内核网络堆栈。
AF_XDP 套接字是一种新的地址族类型。
（[AF_XDP 的内核文档](https://www.kernel.org/doc/html/latest/networking/af_xdp.html)）。

## 课程


### AF_XDP 性能来自哪里？


AF_XDP 套接字非常快，但这种性能提升背后的秘密是什么？

AF_XDP 背后的基本思想之一可以追溯到 [Van Jacobson](https://en.wikipedia.org/wiki/Van_Jacobson) 关于
[网络通道](https://lwn.net/Articles/169961/) 的演讲。它是关于创建一个从驱动程序 RX 队列直接到
（AF_XDP）套接字的无锁 [通道](https://lwn.net/Articles/169961/)。

AF_XDP 使用的基本队列是单生产者/单消费者（SPSC）描述符环队列：

- **单生产者**（SP）绑定到特定的 RX **队列 id**，NAPI-softirq 确保只有
  1 个 CPU 处理 1 个 RX 队列 id（每个调度器间隔）。

- **单消费者**（SC）是一个应用程序，从指向 UMEM 区域的环中读取描述符。

每个数据包 **没有内存分配**。相反，用于数据包的 UMEM 内存区域是预分配的，
因此是有界的。UMEM 区域由多个大小相等的块组成，用户空间已向内核注册
（通过 XDP_UMEM_REG setsockopt 系统调用）。**重要的是**：这也意味着你
有责任及时将帧返回到 UMEM，并为你的应用程序使用模式预分配足够的空间。

Van Jacobson 谈到的 [传输签名](http://www.lemis.com/grog/Documentation/vj/lca06vj.pdf) 被 XDP/eBPF 程序选择 XDP_REDIRECT
到哪个 AF_XDP 套接字所取代。

### 详情：实际上有四个 SPSC 环队列


如 [AF_XDP 内核文档](https://www.kernel.org/doc/html/latest/networking/af_xdp.html) 中所解释的，实际上有 4 个 SPSC 环队列。

总结：AF_XDP /套接字/ 有两个用于 **RX** 和 **TX** 的环，包含指向 UMEM 区域
的描述符。UMEM 区域有两个环：**FILL** 环和 **COMPLETION** 环。在 **FILL**
环中：应用程序给内核一个数据包区域来 **RX** 填充。在 **COMPLETION** 环中，
内核告诉应用程序数据包区域的 **TX 已完成**（然后可以重用）。此方案用于
在内核和用户空间应用程序之间转移 UMEM 数据包区域的所有权。

### RX 队列 id 绑定的陷阱


最常见的错误：为什么我在 AF_XDP 套接字上看不到任何流量？

正如你刚才从上面学到的，AF_XDP 套接字绑定到 **单个 RX 队列 id**
（出于性能原因）。因此，你的用户空间程序只从特定的 RX 队列 id 号
接收原始帧。NIC 默认会使用 RSS 哈希将流分散到所有可用的 RX 队列。
因此，流量可能不会命中你期望的队列。

为了解决这个问题，你 **必须** 配置 NIC 将流引导到特定的 RX 队列。
这可以通过 ethtool 或 TC 硬件卸载过滤器设置来完成。

以下示例展示了如何配置 NIC 将所有 UDP ipv4 流量引导到
/RX 队列 id/ 42：

```sh
ethtool -N <interface> flow-type udp4 action 42
```


参数 /action/ 指定目标 /RX 队列/ 的 id。

通常，流规则由匹配条件和动作组成。L2、L3 和 L4 头部值可用于指定
匹配条件。有关全面的文档，请查阅 ethtool 的 man 页面。它记录了
可用作匹配条件一部分的所有可用头部值。

替代解决方法：
1. 创建与 RXQ 数量相同的 AF_XDP 套接字，让用户空间在所有套接字上
   poll()/select。
2. 出于测试目的将 RXQ 数量减少到 1，
   例如通过命令 `ethtool -L <interface> combined 1`

### 驱动程序支持和零拷贝模式


如简介中暗示的那样，（驱动程序级别）对 AF_XDP 的支持取决于驱动程序
实现 XDP_REDIRECT 动作。对于所有实现基本 XDP_REDIRECT 动作的驱动程序，
支持"复制模式"的 AF_XDP。"复制模式"出人意料地快，将帧（包括任何 XDP
放置的元数据）进行一次复制到 UMEM 区域。用户空间 API 保持不变。

对于 AF_XDP "零拷贝"支持，驱动程序需要实现和暴露用于注册和直接在
NIC RX 环结构中使用 UMEM 区域进行 DMA 传递的 API。

根据你的用例，即使在支持"零拷贝"的驱动程序上使用"复制模式"仍然有意义。
如果出于某种原因，RX 队列上的并非所有流量都是给 AF_XDP 套接字的，
并且 XDP 程序在 XDP_REDIRECT 和 XDP_PASS 之间多路复用，那么"复制模式"
可能是相关的。因为在"零拷贝"模式下执行 XDP_PASS 的成本相当高，
涉及分配内存和复制帧。

## 作业


本课的最终目标是构建一个 AF_XDP 程序，将数据包发送到用户空间，
如果它们是 IPv6 ping 数据包则回复。

我们将使用自动安装的 XDP 程序来完成此操作，但后面的作业之一是手动实现它。
默认的 XDP 程序是一个简单的重定向程序，如果套接字附加到该队列，
则将数据包从特定设备队列重定向到 AF_XDP 套接字。

### 作业 1：运行示例程序以吃掉所有数据包


首先，你需要设置测试环境并启动无限 ping。你可以通过运行以下命令来完成：

```sh
$ eval $(../testenv/testenv.sh alias)
$ t setup --name veth-adv03
$ t ping
```


现在你可以启动 af_xdp_user 应用程序，看到所有 ping 都被它吃掉：

```sh
$ sudo ./af_xdp_user -d veth-adv03
AF_XDP RX:             2 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000185
       TX:             0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:2.000185

AF_XDP RX:             4 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000152
       TX:             0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:2.000152
```


注意：除非你通过传入文件名（如果适用还有程序节）指定要加载的不同 BPF 程序，
否则将加载 libxdp 的 [默认 AF_XDP](https://github.com/xdp-project/xdp-tools/blob/master/lib/libxdp/xsk_def_xdp_prog.c) 程序。

```sh
$ sudo sudo ./af_xdp_user -d veth-adv03 --filename af_xdp_kern.o
AF_XDP RX:             2 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000185
       TX:             0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:2.000185

AF_XDP RX:             4 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000152
       TX:             0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:2.000152
```


### 作业 2：编写 XDP 程序处理每隔一个数据包


对于此练习，你需要编写一个 eBPF 程序，计数接收到的数据包，并使用此值
确定数据包是否需要发送到 AF_XDP 套接字。我们希望每隔一个数据包
发送到 AF_XDP 套接字。

这应该导致每隔一个 ping 数据包被回复。以下是 ping 命令的预期输出，
注意 icmp_seq 数字：

```sh
$ t ping
Running ping from inside test environment:

PING fc00:dead:cafe:1::1(fc00:dead:cafe:1::1) 56 data bytes
64 bytes from fc00:dead:cafe:1::1: icmp_seq=2 ttl=64 time=0.038 ms
64 bytes from fc00:dead:cafe:1::1: icmp_seq=4 ttl=64 time=0.047 ms
64 bytes from fc00:dead:cafe:1::1: icmp_seq=6 ttl=64 time=0.062 ms
64 bytes from fc00:dead:cafe:1::1: icmp_seq=8 ttl=64 time=0.083 ms
```


如果你的自定义程序准备好了，你可以使用 --filename 选项绑定它：

```sh
$ sudo ./af_xdp_user -d veth-adv03 --filename af_xdp_kern.o
AF_XDP RX:             1 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:2.000171
       TX:             0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:2.000171

AF_XDP RX:             2 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:2.000133
       TX:             0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:2.000133
```


注意完整的解决方案包含在 af_xdp_kern.c 文件中。

重要的是要注意，在加载自定义重定向程序的情况下，AF_XDP 套接字创建
涉及使用 **XSK_LIBBPF_FLAGS__INHIBIT_PROG_LOAD** 标志。此标志阻止作为
*xsk_socket__create()* 函数调用的一部分加载默认内核程序。这将创建一个
未在任何 **XSK_MAP** 中输入的 AF_XDP 套接字。因此，调用 **xsk_socket__update_xskmap()**
将 AF_XDP 套接字输入到自定义程序映射中很重要。

### 作业 3：编写用户空间程序回复 IPv6 ping 数据包


对于最后的练习，你需要编写一些用户空间代码来回复 ping 数据包。
这需要在 process_packet() 函数内完成。

完成后所有 ping 都应该收到回复：

```sh
$ sudo ./af_xdp_user -d veth-adv03
AF_XDP RX:             2 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000175
       TX:             2 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000175

AF_XDP RX:             4 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000146
       TX:             4 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000146

AF_XDP RX:             6 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000118
       TX:             6 pkts (         1 pps)           0 Kbytes (     0 Mbits/s) period:2.000118
```


注意完整的解决方案存在于 af_xdp_user.c 文件中。

### 检查加载了哪个 AF_XDP 程序


如果加载了默认的 AF_XDP 程序，你将看到名称：xsk_def_prog。否则，
名称将是从加载的自定义文件中的自定义程序/节名称。

```sh
$ sudo xdp-loader status
CURRENT XDP PROGRAM STATUS:

Interface        Prio  Program name      Mode     ID   Tag               Chain actions
--------------------------------------------------------------------------------------
lo                     <No XDP program loaded!>
veth-adv03             xdp_dispatcher    native   4856 94d5f00c20184d17
 =>              20     xsk_def_prog              4863 03b13f331978c78c  XDP_PASS
```


```sh
$ sudo xdp-loader status
CURRENT XDP PROGRAM STATUS:

Interface        Prio  Program name      Mode     ID   Tag               Chain actions
--------------------------------------------------------------------------------------
lo                     <No XDP program loaded!>
veth-adv03             xdp_dispatcher    native   4840 94d5f00c20184d17
 =>              50     xdp_sock_prog             4847 b215b521770e63fd  XDP_PASS
```


### 从测试环境接口卸载 AF_XDP 程序


```sh
$ sudo xdp-loader unload veth-adv03 --all
```


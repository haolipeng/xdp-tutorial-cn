# 教程：Packet03 - 数据包重定向


现在你已经走到这一步，你知道如何解析数据包数据，以及如何修改数据包。
这是数据包处理系统的两个主要组件，但还缺少一个额外的组件：如何重定向
数据包并将它们传输回网络。本课将涵盖数据包处理的这一方面。

- [本课你将学到的内容](#本课你将学到的内容)
  - [将数据包发送回它们来自的接口](#将数据包发送回它们来自的接口)
  - [将数据包重定向到其他接口](#将数据包重定向到其他接口)
  - [使用内核辅助函数构建路由器](#使用内核辅助函数构建路由器)
- [作业](#作业)
  - [作业 1：将数据包发送回它们来自的地方](#作业-1-将数据包发送回它们来自的地方)
  - [作业 2：在两个接口之间重定向数据包](#作业-2-在两个接口之间重定向数据包)
  - [作业 3：扩展为双向路由器](#作业-3-扩展为双向路由器)
  - [作业 4：使用 BPF 辅助函数进行路由](#作业-4-使用-bpf-辅助函数进行路由)

## 本课你将学到的内容


### 将数据包发送回它们来自的接口


`XDP_TX` 返回值可用于将数据包从它来自的同一接口发送回去。此功能可用于
实现负载均衡器、发送简单的 ICMP 回复等。我们将在作业 1 中使用此功能
来实现一个简单的 ICMP 回显服务器。

请注意，为了使传输和/或重定向功能工作，**所有** 涉及的设备都应该附加
XDP 程序，包括两个 veth 对等端。我们必须这样做，因为除非目标 `veth`
接口的接收端附加了 XDP 程序，否则 `veth` 设备不会传递重定向/重传的
XDP 帧。物理硬件可能表现相同。XDP 维护者目前正在修复上游的这一行为。
请参阅 [Veth XDP: XDP for containers](https://www.netdevconf.org/0x13/session.html?talk-veth-xdp) 演讲，其中描述了此问题背后的原因。
（`xdpgeneric` 模式可以在没有此限制的情况下使用。）

### 将数据包重定向到其他接口


除了能够从同一接口传输数据包外，还有一个选项可以将数据包转发到其他
接口的出口端口（如果相应的驱动程序支持此功能）。这可以使用 `bpf_redirect`
或 `bpf_redirect_map` 辅助函数来完成。这些辅助函数将返回 `XDP_REDIRECT`
值，这是程序应该返回的值。`bpf_redirect` 辅助函数接受重定向端口的接口
索引作为参数，可以与其他辅助函数如 `bpf_fib_lookup` 一起使用。我们将在
作业 2 中以更简单的方式使用它，并在作业 4 中与内核 fib 查找一起再次使用。
要使用 `bpf_redirect_map` 辅助函数，我们需要设置一个类型为 `BPF_MAP_TYPE_DEVMAP`
的特殊映射，它将虚拟端口映射到实际网络设备。请参阅实现 XDP 重定向功能的
[此补丁系列](https://lwn.net/Articles/728146)。使用示例可以在
[xdp_redirect_map_kern.c](https://github.com/xdp-project/xdp-tools/blob/master/xdp-bench/xdp_redirect_devmap.bpf.c)
文件和相应的加载器中找到。

### 使用内核辅助函数构建路由器


正如我们将在作业 2 和 3 中看到的，使用原始重定向功能可能相当具有挑战性，
因为需要支持一组数据结构和自定义的内核到用户空间协议来交换数据。
幸运的是，对于 XDP 和 TC 程序，我们可以使用 `bpf_fib_lookup()` 辅助函数
访问内核路由表，并使用此信息重定向数据包。作业 4 展示了如何使用此辅助
函数编写完整重定向的程序。

使用 `bpf_fib_lookup()` 函数时需要注意的一点是，如果入口接口禁用了转发，
它将返回错误代码，因此我们需要在运行作业 4 的代码之前启用转发。请注意，
启用转发对于 `bpf_redirect_map` 或 `bpf_redirect` 函数不是必需的，
只对 `bpf_fib_lookup` 是必需的。

## 作业


### 作业 1：将数据包发送回它们来自的地方


使用 `XDP_TX` 功能实现 ICMP/ICMPv6 回显服务器。即，交换目标和源 MAC 地址，
然后交换 IP/IPv6 地址，最后将 ICMP/ICMPv6 `Type` 字段替换为适当的值。

请注意，更改 `Type` 字段会影响 ICMP 校验和。但是，由于只有一小部分
数据包在更改，可以使用增量互联网校验和（RFC 1624），所以使用
`bpf_csum_diff` 辅助函数来更新校验和。

要测试回显服务器，创建一个支持两个地址族的新环境并加载 XDP 程序。
请注意，我们还需要为对等设备加载一个虚拟 `xdp_pass` 程序，如
[将数据包发送回它们来自的接口](#sending-packets-back-to-the-interface-they-came-from) 部分所述。

```bash
$ t setup -n test --legacy-ip
$ t exec -n test -- ./xdp-loader load --prog-name xdp_pass_func veth0 xdp_prog_kern.o
$ t load -n test -- --prog-name xdp_icmp_echo_func xdp_prog_kern.o
```


Ping 主机并使用 `xdp_stat` 程序检查 ICMP 回显服务器是否确实返回了 `XDP_TX`。
对两个地址族重复（你也可以将 `--legacy-ip` 选项传递给 `t ping` 命令）：

```bash
$ t ping
#...
$ t ping --legacy-ip
#...
$ sudo ./xdp_stats -d test
Collecting stats from BPF map
 - BPF map (bpf_map_type:6) id:115 name:xdp_stats_map key_size:4 value_size:16 max_entries:5
XDP-action
XDP_ABORTED            0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250206
XDP_DROP               0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250262
XDP_PASS               0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250259
XDP_TX                 8 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250257
XDP_REDIRECT           0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250255
```


### 作业 2：在两个接口之间重定向数据包


下图显示了两个名为 `left` 和 `right` 的虚拟环境。由 `eth1` 接口产生的
以太网数据包将到达 `right` 接口，并具有 `(dest`Y1,source`Y2)` 以太网头部。
你的目标是将这些数据包重定向到 `left` 接口。重定向的数据包将出现在
`left` 接口的出口端口上，因此以太网头部应更改为 `(dest`X2,source`X1)`，
否则数据包将被 `eth0` 接口丢弃。

```
Env 1                         Env 2
----------------------        ----------------------
|    eth0 (MAC=X2)   |        |    eth1 (MAC=Y2)   |
----------||----------        ----------||----------
    veth0 (MAC=X1)  <-----------  veth1 (MAC=Y1)
```


设置两个环境，相应地修补 `xdp_redirect` 程序，并将其附加到 `right` 接口。
不要忘记像这样为 left /inner/ 接口附加一个虚拟程序：

```bash
$ t exec -n left -- ./xdp-loader load --prog-name xdp_pass_func veth0 xdp_prog_kern.o
```


要测试，加载程序，进入 right 环境，并 ping left 环境的 /inner/ 接口
（你的 IPv6 地址可能不同）：

```bash
$ t enter -n right
$ ping fc00:dead:cafe:1::2
```


在 `left` 环境内运行 `tcpdump` 程序。你应该看到 ping 请求被传递，
ping 回复被发送回来。但是，除非在主机上启用了转发，否则它们不会被传递。
（我们将在下一个作业中修复这个问题。）

```bash
$ t enter -n left
# tcpdump -l
listening on veth0, link-type EN10MB (Ethernet), capture size 262144 bytes
17:03:11.455320 IP6 fc00:dead:cafe:2::2 > fc00:dead:cafe:1::2: ICMP6, echo request, seq 1, length 64
17:03:11.455343 IP6 fc00:dead:cafe:1::2 > fc00:dead:cafe:2::2: ICMP6, echo reply, seq 1, length 64
```


最后，为了以防万一，检查 `right` 环境是否确实重定向了数据包
（`XDP_REDIRECT` 行应该非零）：

```bash
$ sudo ./xdp_stats -d right

Collecting stats from BPF map
 - BPF map (bpf_map_type:6) id:183 name:xdp_stats_map key_size:4
   value_size:16 max_entries:5
XDP-action
XDP_ABORTED            0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250143
XDP_DROP               0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250180
XDP_PASS               0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250180
XDP_TX                 0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250179
XDP_REDIRECT         176 pkts (         4 pps)          20 Kbytes (     0 Mbits/s) period:0.250179
```


### 作业 3：扩展为双向路由器


在上一个作业中，我们能够将数据包从一个接口传递到另一个。但是，我们需要
硬编码接口号和 MAC 地址。这不实用，我们将在此作业中使用更好的技术。

此作业将展示如何使用 `bpf_redirect_map` 函数。除此之外，为了使程序更有用，
我们将使用一个包含源和目标 MAC 地址之间映射的映射。此作业的实际目标是
编写一个用户空间辅助程序，在加载程序后配置这些映射，因为 XDP 部分非常简单。
为此，修补 `xdp_prog_user.c` 程序。

要测试代码，像作业 2 那样配置环境，并在两个接口上安装 `xdp_redirect_map`
程序：

```bash
$ t load -n left -- --prog-name xdp_redirect_map_func xdp_prog_kern.o
$ t load -n right -- --prog-name xdp_redirect_map_func xdp_prog_kern.o
```


不要忘记内部接口的虚拟程序：

```bash
$ t exec -n left -- ./xdp-loader load --prog-name xdp_pass_func veth0 xdp_prog_kern.o
$ t exec -n right -- ./xdp-loader load --prog-name xdp_pass_func veth0 xdp_prog_kern.o
```


使用新的 `xdp_prog_user` 辅助程序为两个接口配置参数。为简单起见，
有一个新的特殊辅助程序 `t redirect`，它将为你完成工作。查看其实现
以了解它如何通过接口名称获取内部 MAC 地址。

```bash
$ t redirect right left
```


两个内部接口之间的 ping 现在应该可以通过了。通过在两个接口上运行
`xdp_stats` 来检查它们是否确实被我们的程序转发：

```bash
$ sudo ./xdp_stats -d right

Collecting stats from BPF map
 - BPF map (bpf_map_type:6) id:183 name:xdp_stats_map key_size:4 value_size:16 max_entries:5
XDP-action
XDP_ABORTED            0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250185
XDP_DROP               0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250239
XDP_PASS               0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250234
XDP_TX                 0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250231
XDP_REDIRECT        1303 pkts (         0 pps)         153 Kbytes (     0 Mbits/s) period:0.250228

^C
$ sudo ./xdp_stats -d left

Collecting stats from BPF map
 - BPF map (bpf_map_type:6) id:186 name:xdp_stats_map key_size:4 value_size:16 max_entries:5
XDP-action
XDP_ABORTED            0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250154
XDP_DROP               0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250206
XDP_PASS               0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250206
XDP_TX                 0 pkts (         0 pps)           0 Kbytes (     0 Mbits/s) period:0.250206
XDP_REDIRECT          22 pkts (         0 pps)           2 Kbytes (     0 Mbits/s) period:0.250206

^C
```


但是，如果我们尝试从内部 ping 外部接口或反过来，我们不会看到任何回复，
因为发往外部接口的数据包也会被重定向。此外，我们的实现不容易扩展到
两个以上的接口。下一个作业将展示如何使用内核辅助函数以更好的方式转发数据包。

### 作业 4：使用 BPF 辅助函数进行路由


完成作业 3 后，你将在两个内部接口之间有一个硬编码的重定向。如上所述，
我们只能在内部接口之间传递数据包——发往外部接口的数据包将被传递到
相反的内部接口，并因为错误的目标 L3 地址而在那里被丢弃。我们可以手动
检查 IP/IPv6 地址，并在数据包发往外部接口时返回 `XDP_PASS`，但这并不
涵盖所有情况，动态查找每个数据包应该去哪里不是更好吗？

此作业教授如何使用 `bpf_fib_lookup` 辅助函数。此函数让 XDP 和 TC 程序
访问内核路由表，并将返回要将数据包转发到的接口的 ifindex，以及源和
目标 mac 地址。更新以太网头部后，我们可以使用 `bpf_redirect` 函数将
数据包重定向到此接口。

此作业大部分复制了 Linux 内核中的
[xdp_fwd_kern.c](https://github.com/torvalds/linux/blob/master/samples/bpf/xdp_fwd_kern.c)
示例，但已修补以像其他示例一样更新统计数据，并检查 `bpf_fib_lookup()`
函数的所有返回值。

要测试路由器，检查你是否可以在任意两个接口之间进行 ping 和/或建立
TCP 连接：inner-inner、inner-outer、outer-outer。对于 inner-outer
通信，程序应该返回 `XDP_PASS`，对于 inner-inner 应该返回 `XDP_REDIRECT`。

尝试两个以上的测试环境。运行 `xdp_stats` 程序以验证是 XDP 程序在进行
转发，而不是网络堆栈（因为如上所述，此作业应该启用转发）。不要忘记
为接口启用转发。

```bash
$ t setup -n uno --legacy-ip
$ t setup -n dos --legacy-ip
$ t setup -n tres --legacy-ip

$ sudo sysctl net.ipv4.conf.all.forwarding=1
$ sudo sysctl net.ipv6.conf.all.forwarding=1

$ t load -n uno -- --prog-name xdp_router_func xdp_prog_kern.o
$ t load -n dos -- --prog-name xdp_router_func xdp_prog_kern.o
$ t load -n tres -- --prog-name xdp_router_func xdp_prog_kern.o

$ t exec -n uno -- ./xdp-loader load --prog-name xdp_pass_func veth0 xdp_prog_kern.o
$ t exec -n dos -- ./xdp-loader load --prog-name xdp_pass_func veth0 xdp_prog_kern.o
$ t exec -n tres -- ./xdp-loader load --prog-name xdp_pass_func veth0 xdp_prog_kern.o

$ sudo ./xdp_stats -d uno
$ sudo ./xdp_stats -d dos
$ sudo ./xdp_stats -d tres
```


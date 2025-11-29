# Experiment01 - 访问数据包末尾的数据


此示例展示了如何在 XDP `data_end` 处访问 BPF 数据包数据。
像这样的示例是需要的，因为程序员需要说服 BPF 验证器访问边界是安全的。

## 用例：尾部增长时间戳


BPF 辅助函数 `bpf_xdp_adjust_tail` 正在扩展，增加了在尾部增长
数据包大小的能力。要使用它做任何事情，我们需要演示如何在 XDP
`data_end` 处访问数据包数据。

一个用例是在 XDP 处理时 **在扩展的尾部空间添加时间戳**，当数据包被
网络堆栈处理时（通过 XDP_PASS）这些时间戳会保留下来。捕获此时间戳的
一种方法是使用 `tcpdump`，它可以用来确定在网络堆栈中花费的时间
（在没有硬件时间戳的 NIC 上）。

在主示例 [xdp_prog_kern.c](xdp_prog_kern.c) 中，`xdp_tailgrow_parse` 代码通过解析到
IP 层，并使用 IP 头部的总长度字段（[iphdr->tot_len](https://elixir.bootlin.com/linux/v5.6.10/source/include/uapi/linux/ip.h#L97)）来实现这一点。
查看代码了解说服验证器所需的奇怪边界检查。请注意，为测试目的，
这仅限于 IPv4 ICMP 数据包。

### 附注：额外程序


附注：[xdp_prog_kern.c](xdp_prog_kern.c) 还包含一些其他较小的程序来测试
`bpf_xdp_adjust_tail` 增长是否有效，以及在执行 `XDP_TX` 时对开销
进行基准测试。通过 `xdp_loader` 选项 `--prog`= 选择其他 BPF 程序，如下：

```bash
 sudo ./xdp_loader --dev mlx5p1 --force --prog xdp_tailgrow
 sudo ./xdp_loader --dev mlx5p1 --force --prog xdp_tailgrow_tx
```


## 替代方法


### 有效：使用循环访问 data_end


[xdp_prog_kern2.c](xdp_prog_kern2.c) 中的代码展示了如何找到 `data_end`，
*不解析数据包内容*，而是通过在有界循环中一次将 `data` 位置指针
向前移动一个字节。具有最大迭代次数的有界循环允许验证器看到边界。
（这显然依赖于在内核 [v5.3](https://git.kernel.org/torvalds/c/v5.3-rc1~140^2~179^2^2~5) 中添加的有界循环支持）。
这不是很高效，但它有效。

## 失败的方法


访问 XDP `data_end` 处 BPF 数据包数据的方法。

### 失败#1：使用数据包长度


在示例 [xdp_prog_fail1.c](xdp_prog_fail1.c) 中，我们尝试使用数据包长度
（计算为 `data_end - data`）作为添加到 `data` 的偏移量来访问最后一个字节。
验证器拒绝了这一点，因为动态长度计算不能用于静态分析。

```bash
 sudo ./xdp_loader --dev mlx5p1 --force --file xdp_prog_fail1.o
```


### 失败#2：直接使用 data_end


在示例 [xdp_prog_fail2.c](xdp_prog_fail2.c) 中，我们尝试或多或少直接使用 `data_end`
指针来找到数据包中的最后一个字节。数据包数据 [区间](https://www.mathwords.com/i/interval_notation.htm) 定义为
`[data, data_end)`，意味着 `data_end` 指向的字节是 **排除的**。
示例尝试访问倒数第二个字节（为了有一个不会被编译器优化移除的代码 if 结构）。

```bash
 sudo ./xdp_loader --dev mlx5p1 --force --file xdp_prog_fail2.o
```


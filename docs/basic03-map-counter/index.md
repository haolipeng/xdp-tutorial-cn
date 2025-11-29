# 教程：Basic03 - 使用 BPF 映射计数


在本课中，你将学习 BPF 映射，这是 BPF 程序可用的持久存储机制。作业将让你
亲身体验扩展"值"大小/内容，以及从用户空间读取内容。

在本课中，我们将只涵盖两种简单的映射类型：
 - `BPF_MAP_TYPE_ARRAY` 和
 - `BPF_MAP_TYPE_PERCPU_ARRAY`。

- [本课你将学到的内容](#本课你将学到的内容)
  - [定义映射](#定义映射)
  - [libbpf 映射 ELF 重定位](#libbpf-映射-elf-重定位)
  - [bpf_object 到 bpf_map](#bpf_object-到-bpf_map)
  - [从用户空间读取映射值](#从用户空间读取映射值)
- [有用的示例命令](#有用的示例命令)
- [作业](#作业)
  - [作业 1：添加字节计数器](#作业-1-添加字节计数器)
  - [作业 2：处理其他 XDP 动作统计](#作业-2-处理其他-xdp-动作统计)
  - [作业 3：每 CPU 统计](#作业-3-每-cpu-统计)

## 本课你将学到的内容


### 定义映射


创建 BPF 映射是通过在 [xdp_prog_kern.c](xdp_prog_kern.c) 中定义一个全局结构体，
使用特殊的 `SEC(".maps")` 如下：

```c
struct {
	__uint(type, BPF_MAP_TYPE_ARRAY);
	__type(key, __u32);
	__type(value, struct datarec);
	__uint(max_entries, XDP_ACTION_MAX);
} xdp_stats_map SEC(".maps");
```


BPF 映射是通用的 **键/值** 存储（因此有 `key` 和 `value` 类型参数），
具有给定的映射 `type` 和最大允许条目数 `max_entries`。这里我们关注
简单的 `BPF_MAP_TYPE_ARRAY`，这意味着当映射首次创建时会分配
`max_entries` 个数组元素。

BPF 映射可以从 BPF 程序（内核）端和用户空间访问。如何做到这一点以及
它们有何不同是本课的一部分。

### libbpf 映射 ELF 重定位


值得指出的是，一切都通过 bpf 系统调用进行。这意味着用户空间程序 /必须/
使用单独的 bpf 系统调用来创建映射和程序。那么 BPF 程序如何引用 BPF 映射呢？

这是通过首先加载所有 BPF 映射，并存储它们对应的文件描述符（FD）来实现的。
然后使用 ELF 重定位表来识别 BPF 程序对给定映射的每个引用；然后重写每个
这样的引用，使 BPF 字节码指令为每个映射使用正确的映射 FD。

所有这些都需要在 BPF 程序本身可以加载到内核之前完成。幸运的是，libbpf
库处理 ELF 对象解码和映射引用重定位，对执行加载的用户空间程序是透明的。

### bpf_object 到 bpf_map


正如你在 [basic02](file:../basic02-prog-by-name/) 中学到的，libbpf API 有"对象"和处理这些对象的函数。
结构体 `bpf_object` 代表 ELF 对象本身。

与我们对 BPF 函数所做的类似，我们的加载器有一个名为 `find_map_fd()`
的函数（在 [xdp_load_and_stats.c](xdp_load_and_stats.c) 中），它使用库函数
`bpf_object__find_map_by_name()` 来查找具有给定名称的 `bpf_map` 对象。
（注意，映射名称的长度由 ELF 提供，比内核加载后存储的名称更长）。
找到 `bpf_map` 后，我们通过 `bpf_map__fd()` 获取映射文件描述符。
还有一个 libbpf 函数包装了这两个步骤，叫做 `bpf_object__find_map_fd_by_name()`。

### 从用户空间读取映射值


映射的内容通过函数 `bpf_map_lookup_elem()` 从用户空间读取，这是一个简单的
系统调用包装器，在映射文件描述符（FD）上操作。系统调用查找 `key` 并将值
存储到 value 指针提供的内存区域中。调用的用户空间程序有责任确保分配用于
保存返回值的内存足够大以存储映射中包含的数据类型。在我们的示例中，我们
演示了用户空间如何通过系统调用包装器 `bpf_obj_get_info_by_fd()` 查询映射 FD
并获取 `bpf_map_info` 结构体中的一些信息。

例如，程序 `xdp_load_and_stats` 将定期读取 xdp_stats_map 值并生成一些统计数据。

## 有用的示例命令


```bash
# 将 eBPF 程序加载到 localhost 接口
sudo ./xdp_load_and_stats --dev lo

# 从 localhost 接口卸载 eBPF 程序
sudo ./xdp_load_and_stats --dev lo --unload-all

# 从 localhost 端口 12345 接收数据
ncat -lk 127.0.0.1 12345

# 向 localhost 端口 12345 发送数据
printf 'hello from sender\n' | nc 127.0.0.1 12345
```


## 作业


作业在代码中通过 `Assignment#num` 注释标记了"提示"。

### 作业 1：添加字节计数器


当前的作业代码只计数数据包。你的 **作业** 是扩展它以同时计数字节。

注意 BPF 映射 `xdp_stats_map` 的使用方式：
 - `.value_size ` sizeof(struct datarec)=

BPF 映射不了解用于值记录的数据结构，它只知道大小。（[BPF 类型格式](https://github.com/torvalds/linux/blob/master/Documentation/bpf/btf.rst)（[BTF](https://www.kernel.org/doc/html/latest/bpf/btf.html)）
是一个高级主题，允许通过调试信息关联数据结构知识，但我们暂时忽略它）。
因此，由双方（用户空间和 BPF 程序内核端）确保它们在 `value` 的内容和
结构上保持同步。这里关于使用的数据结构的提示来自 `sizeof(struct datarec)`，
它表明使用了 `struct datarec`。

这个 `struct datarec` 在包含文件 [common_kern_user.h](common_kern_user.h) 中定义为：

```c
/* 这是存储在映射中的数据记录 */
struct datarec {
	__u64 rx_packets;
	/* Assignment#1: 添加字节计数器 */
};
```


#### 作业 1.1：更新 BPF 程序


下一步是更新内核端 BPF 程序：[xdp_prog_kern.c](xdp_prog_kern.c)。

要弄清数据包的长度，你需要了解 BPF 程序在被内核调用时获得指针的上下文
变量 `*ctx`，类型为 [struct xdp_md](https://elixir.bootlin.com/linux/v5.0/ident/xdp_md)。这个 `struct xdp_md` 有点奇怪，
因为所有成员的类型都是 `__u32`。然而，这实际上不是它们的真实数据类型，
因为当程序加载到内核时，对此数据结构的访问会被内核重新映射。访问被
重新映射到 `xdp_buff` 结构体和 `xdp_rxq_info` 结构体。

```c
struct xdp_md {
	// (注意：类型 __u32 不是真实类型)
	__u32 data;
	__u32 data_end;
	__u32 data_meta;
	/* 以下访问通过 struct xdp_rxq_info */
	__u32 ingress_ifindex; /* rxq->dev->ifindex */
	__u32 rx_queue_index;  /* rxq->queue_index */
};
```


虽然我们知道这一点，但编译器不知道。所以我们需要在使用字段之前将它们
类型转换为 void 指针：

```c
	void *data_end = (void *)(long)ctx->data_end;
	void *data     = (void *)(long)ctx->data;
```


下一步是计算每个数据包中的字节数，只需从 `data_end` 减去 `data`，
并更新 datarec 成员。

```c
	__u64 bytes = data_end - data; /* 计算数据包长度 */
	lock_xadd(&rec->rx_bytes, bytes);
```


#### 作业 1.2：更新用户空间程序


现在是时候更新读取统计数据的用户空间程序了（在 [xdp_load_and_stats.c](xdp_load_and_stats.c) 中）。

更新函数：
 - `map_collect()` 以同时收集 rx_bytes。
 - `stats_print()` 以同时打印 rx_bytes（调整格式字符串）

### 作业 2：处理其他 XDP 动作统计


注意我们上面定义的 BPF 映射 `xdp_stats_map` 实际上是一个数组，
`max_entries`XDP_ACTION_MAX=。这个想法是按 [(enum) xdp_action](https://elixir.bootlin.com/linux/latest/ident/xdp_action) 保存统计数据，
但我们的程序还没有利用这一点。

*作业* 是扩展用户空间统计工具（在 [xdp_load_and_stats.c](xdp_load_and_stats.c) 中）
以收集和打印这些额外的统计数据。

### 作业 3：每 CPU 统计


到目前为止，我们一直使用原子操作来增加统计计数器；然而，这很昂贵，
因为它插入内存屏障以确保不同的 CPU 不会混淆彼此的数据。我们可以通过
使用另一种在每 CPU 存储中存储数据的数组类型来避免这种情况。缺点是
我们将求和的负担转移到了用户空间。

要实现这一点，第一步是更改映射 `type`（在 [xdp_prog_kern.c](xdp_prog_kern.c) 中）
以使用 `BPF_MAP_TYPE_PERCPU_ARRAY`。如果你只做这个更改，用户空间程序
会检测到这一点并报错，因为我们查询映射 FD 以获取一些信息
（通过 `bpf_obj_get_info_by_fd()`）并检查映射类型。记住用户空间有责任
确保值的数据记录足够大。

下一步是编写一个获取每个 CPU 的值并求和的函数。在 [xdp_load_and_stats.c](xdp_load_and_stats.c) 中。
你可以复制粘贴这个，并在函数 `map_collect()` 的 switch-case 语句中调用它：

```c
/* BPF_MAP_TYPE_PERCPU_ARRAY */
void map_get_value_percpu_array(int fd, __u32 key, struct datarec *value)
{
	/* 对于 percpu 映射，用户空间获取每个可能的 CPU 的值 */
	unsigned int nr_cpus = libbpf_num_possible_cpus();
	struct datarec values[nr_cpus];
	__u64 sum_bytes = 0;
	__u64 sum_pkts = 0;
	int i;

	if ((bpf_map_lookup_elem(fd, &key, values)) != 0) {
		fprintf(stderr,
			"ERR: bpf_map_lookup_elem failed key:0x%X\n", key);
		return;
	}

	/* 求和每个 CPU 的值 */
	for (i = 0; i < nr_cpus; i++) {
		sum_pkts  += values[i].rx_packets;
		sum_bytes += values[i].rx_bytes;
	}
	value->rx_packets = sum_pkts;
	value->rx_bytes   = sum_bytes;
}
```


# 教程：Tracing03 - 调试打印


在本课中，我们将展示如何从 eBPF 程序打印消息到 tracefs 缓冲区。

- [eBPF trace printk 辅助函数](#ebpf-trace-printk-辅助函数)
- [tracefs 管道读取器](#tracefs-管道读取器)
- [作业](#作业)
  - [作业 1：设置测试环境](#作业-1-设置测试环境)
  - [作业 2：运行调试代码](#作业-2-运行调试代码)

## eBPF trace printk 辅助函数


bpf_trace_print 辅助函数在调试或需要从 eBPF 程序获得即时反馈时非常有用。

它提供有限的 trace_printk 功能，基本上将消息存储到 tracefs 缓冲区。

bpf_trace_printk 接口是：

```sh
#define __bpf_printk(fmt, ...)					\
({												\
	BPF_PRINTK_FMT_MOD char ____fmt[] = fmt;	\
	bpf_trace_printk(____fmt, sizeof(____fmt),	\
			 ##__VA_ARGS__);					\
})

/*
 * __bpf_vprintk 用可变参数而不是 u64 数组包装 bpf_trace_vprintk 辅助函数。
 */
#define __bpf_vprintk(fmt, args...)						\
({														\
	static const char ___fmt[] = fmt;					\
	unsigned long long ___param[___bpf_narg(args)];		\
														\
	_Pragma("GCC diagnostic push")						\
	_Pragma("GCC diagnostic ignored \"-Wint-conversion\"")	\
	___bpf_fill(___param, args);						\
	_Pragma("GCC diagnostic pop")						\
														\
	bpf_trace_vprintk(___fmt, sizeof(___fmt),			\
			  ___param, sizeof(___param));				\
})

/* 当 bpf_printk 调用有 3 个或更少的格式参数时使用 __bpf_printk
 * 否则使用 __bpf_vprintk
 */
#define ___bpf_pick_printk(...) \
	___bpf_nth(_, ##__VA_ARGS__, __bpf_vprintk, __bpf_vprintk, __bpf_vprintk,	\
		   __bpf_vprintk, __bpf_vprintk, __bpf_vprintk, __bpf_vprintk,		\
		   __bpf_vprintk, __bpf_vprintk, __bpf_printk /*3*/, __bpf_printk /*2*/,\
		   __bpf_printk /*1*/, __bpf_printk /*0*/)

/* 用于打印调试消息的辅助宏 */
#define bpf_printk(fmt, args...) ___bpf_pick_printk(args)(fmt, ##args)
```


因为上述接口需要放入格式字符串的大小，使用 `bpf_printk(fmt, args...)`
辅助函数更方便：

```sh
SEC("xdp")
int xdp_prog_simple(struct xdp_md *ctx)
{
        bpf_printk("...");
        return XDP_PASS;
}
```


## tracefs 管道读取器


要检索 bpf_trace_printk 打印的消息，你可以直接读取 tracefs 缓冲区：

```sh
$ sudo cat /sys/kernel/debug/tracing/trace_pipe
```


或者你可以使用标准 C 文件读取/解析代码来获取数据：

```sh
stream = fopen(TRACEFS_PIPE, "r");

...

while ((nread = getline(&line, &len, stream)) != -1) {
```


更多详情请查看 trace_read.c 文件。

## 作业


### 作业 1：设置测试环境


在本课中，我们将使用前一课的设置：
Basic02 - 按名称加载程序 [https://github.com/xdp-project/xdp-tutorial/tree/master/basic02-prog-by-name#assignment-2-add-xdp_abort-program](https://github.com/xdp-project/xdp-tutorial/tree/master/basic02-prog-by-name#assignment-2-add-xdp_abort-program)

设置环境：

```sh
$ sudo ../testenv/testenv.sh setup --name veth-basic02
```


从 xdp_prog_kern.o 加载 XDP 程序，它将在每个传入数据包上打印以太网头部：

```sh
$ sudo xdp-loader load veth-basic02 xdp_prog_kern.o -s xdp
```


并生成一些数据包：

```sh
$ sudo ../testenv/testenv.sh enter --name veth-basic02
# ping fc00:dead:cafe:1::1
PING fc00:dead:cafe:1::1(fc00:dead:cafe:1::1) 56 data bytes
```


### 作业 2：运行调试代码


```sh
bpf_printk("src: %llu, dst: %llu, proto: %u\n",
           ether_addr_to_u64(eth->h_source),
           ether_addr_to_u64(eth->h_dest),
           bpf_ntohs(eth->h_proto));
```


你可以通过 tracefs 监控消息：

```sh
$ sudo cat /sys/kernel/debug/tracing/trace_pipe
ping-28172 [001] ..s1 155229.100016: 0: src: 99726513069783, dst: 63819112930922, proto: 56710
ping-28172 [001] ..s1 155230.124054: 0: src: 99726513069783, dst: 63819112930922, proto: 56710
ping-28172 [001] ..s1 155231.148018: 0: src: 99726513069783, dst: 63819112930922, proto: 56710
ping-28172 [001] ..s1 155232.172022: 0: src: 99726513069783, dst: 63819112930922, proto: 56710
```


或使用 trace_read 应用程序：

```sh
$ sudo ./trace_read
src: 5a:b3:63:62:de:d7 dst: 3a:b:b:8e:5e:6a proto: 56710
src: 5a:b3:63:62:de:d7 dst: 3a:b:b:8e:5e:6a proto: 56710
src: 5a:b3:63:62:de:d7 dst: 3a:b:b:8e:5e:6a proto: 56710
...
```


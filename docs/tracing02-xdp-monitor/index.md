# 教程：Tracing02 - 监控 xdp 跟踪点


在本课中，我们将展示如何附加和监控所有与 xdp 相关的跟踪点，
以及将一些相关信息发送到用户空间统计应用程序。

- [跟踪点](#跟踪点)
- [作业](#作业)
  - [作业 1：监控所有 xdp 跟踪点](#作业-1-监控所有-xdp-跟踪点)
- [替代解决方案](#替代解决方案)
  - [bpftrace](#bpftrace)
  - [perf record](#perf-record)

## 跟踪点


跟踪点对于调试 XDP 非常有用，特别是对于 XDP_REDIRECT。

为了获得性能，XDP_REDIRECT 对目标进行 RX 批量处理，不幸的是这意味着
XDP 程序不会通过 BPF 辅助调用 `bpf_redirect()`（或 `bpf_redirect_map`）
直接返回错误。相反，可以通过使用内核中可用的 XDP 跟踪点来调试这些错误。

bpf 库期望跟踪点 eBPF 程序存储在具有以下名称的节中：

```sh
tracepoint/<sys>/<tracepoint>
```


其中 `<sys>` 是跟踪点子系统，`<tracepoint>` 是跟踪点名称，
可以使用以下结构完成：

```sh
SEC("tracepoint/xdp/xdp_exception")
int trace_xdp_exception(struct xdp_exception_ctx *ctx)
```


通过 libbpf 库以通常的方式 `open` 和 `load` bpf_object。例如：

```c
	obj = bpf_object__open_file(cfg->filename, NULL)
	bpf_object__load(obj);
```


然后你可以遍历所有程序并将每个程序附加到跟踪点：

```c
bpf_object__for_each_program(prog, obj) {
	...
	tp_link = bpf_program__attach_tracepoint(prog, "xdp", tp);
	err = libbpf_get_error(tp_link);
	...
}
```


更多详情请查看 [trace_load_and_stats.c](trace_load_and_stats.c) 对象中的
load_bpf_and_trace_attach 函数。

## 作业


### 作业 1：监控所有 xdp 跟踪点


```sh
$ sudo ./trace_load_and_stats
XDP-event       CPU:to  pps          drop-pps     extra-info
XDP_REDIRECT    total   0            0            Success
XDP_REDIRECT    total   0            0            Error
Exception       0       0            11           XDP_UNKNOWN
Exception       1       0            2            XDP_UNKNOWN
Exception       2       0            36           XDP_UNKNOWN
Exception       3       0            29           XDP_UNKNOWN
Exception       4       0            3            XDP_UNKNOWN
Exception       5       0            8            XDP_UNKNOWN
Exception       total   0            91           XDP_UNKNOWN
cpumap-kthread  total   0            0            0
devmap-xmit     total   0            0            0.00
```


## 替代解决方案


### bpftrace


bpftrace 工具易于构建单行命令来捕获和计数给定跟踪点的事件。
例如，附加到所有 XDP 跟踪点并计数它们：

```sh
sudo bpftrace -e 'tracepoint:xdp:* { @cnt[probe] = count(); }'
Attaching 12 probes...
^C

@cnt[tracepoint:xdp:mem_connect]: 18
@cnt[tracepoint:xdp:mem_disconnect]: 18
@cnt[tracepoint:xdp:xdp_exception]: 19605
@cnt[tracepoint:xdp:xdp_devmap_xmit]: 1393604
@cnt[tracepoint:xdp:xdp_redirect]: 22292200
```


要提取作为 `err` 参数一部分返回的 "ERRNO"，这个 bpftrace
单行命令很有用：

```sh
 sudo bpftrace -e \
  'tracepoint:xdp:xdp_redirect*_err {@redir_errno[-args->err] = count();}
   tracepoint:xdp:xdp_devmap_xmit {@devmap_errno[-args->err] = count();}'
```


### perf record


perf 工具也支持开箱即用地记录跟踪点：

```bash
  perf record -a -e xdp:xdp_redirect_err \
       -e xdp:xdp_redirect_map_err \
       -e xdp:xdp_exception \
       -e xdp:xdp_devmap_xmit
```


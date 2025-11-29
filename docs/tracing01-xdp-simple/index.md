# 教程：Tracing01 - 监控 xdp 跟踪点


在本课中，我们将展示如何创建和加载挂钩到 xdp:exception 跟踪点的
eBPF 程序，并将其值获取到用户空间统计应用程序。

- [XDP 跟踪点](#xdp-跟踪点)
  - [跟踪点程序节](#跟踪点程序节)
  - [跟踪点参数](#跟踪点参数)
  - [跟踪点附加](#跟踪点附加)
- [HASH 映射](#hash-映射)
- [作业](#作业)
  - [作业 1：设置测试环境](#作业-1-设置测试环境)
  - [作业 2：加载跟踪点监控程序](#作业-2-加载跟踪点监控程序)

## XDP 跟踪点


eBPF 程序也可以附加到跟踪点。有几个与 xdp 跟踪点子系统相关的跟踪点：

```bash
ls /sys/kernel/debug/tracing/events/xdp/
xdp_cpumap_enqueue
xdp_cpumap_kthread
xdp_devmap_xmit
xdp_exception
xdp_redirect
xdp_redirect_err
xdp_redirect_map
xdp_redirect_map_err
```


### 跟踪点程序节


bpf 库期望跟踪点 eBPF 程序存储在具有以下名称的节中：

```c
tracepoint/<sys>/<tracepoint>
```


其中 `<sys>` 是跟踪点子系统，`<tracepoint>` 是跟踪点名称，
可以使用以下结构完成：

```bash
SEC("tracepoint/xdp/xdp_exception")
int trace_xdp_exception(struct xdp_exception_ctx *ctx)
```


### 跟踪点参数


有一个程序指针参数指向定义跟踪点字段的结构。

例如对于 xdp:xdp_exception 跟踪点：

```c
struct xdp_exception_ctx {
        __u64 __pad;      // 前 8 个字节不能被 bpf 代码访问
        __s32 prog_id;    //      offset:8;  size:4; signed:1;
        __u32 act;        //      offset:12; size:4; signed:0;
        __s32 ifindex;    //      offset:16; size:4; signed:1;
};

int trace_xdp_exception(struct xdp_exception_ctx *ctx)
```


此结构在跟踪点格式文件中导出：

```c
# cat /sys/kernel/debug/tracing/events/xdp/xdp_exception/format
...
        field:unsigned short common_type;       offset:0;       size:2; signed:0;
        field:unsigned char common_flags;       offset:2;       size:1; signed:0;
        field:unsigned char common_preempt_count;       offset:3;       size:1; signed:0;
        field:int common_pid;   offset:4;       size:4; signed:1;

        field:int prog_id;      offset:8;       size:4; signed:1;
        field:u32 act;  offset:12;      size:4; signed:0;
        field:int ifindex;      offset:16;      size:4; signed:1;
...
```


### 跟踪点附加


要为此示例加载跟踪点程序，我们使用以下 bpf 库辅助函数：

```bash
bpf_object__open_file(cfg->filename, NULL);
```


```bash
bpf_object__load(obj);
```


要将程序附加到跟踪点，我们需要创建一个跟踪点 perf 事件，并使用其
文件描述符将 eBPF 程序附加到它。在底层，此函数设置
PERF_EVENT_IOC_SET_BPF ioctl 调用：

```bash
bpf_program__attach_tracepoint(prog, "xdp", "xdp_exception");
```


请查看 trace_load_and_stats.c 中的 load_bpf_and_trace_attach 函数
了解所有细节。

## HASH 映射


此示例使用 PERCPU HASH 映射，存储每个接口的中止数据包数量：

```c
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_HASH);
    __type(key, __s32);
    __type(value, __u64);
    __uint(max_entries, 10);
} xdp_stats_map SEC(".maps");
```


接口与 ARRAY 映射类似，除了如果元素不存在，我们需要在哈希中
专门创建新元素：

```c
/* 在内核 BPF 端查找返回指向实际数据的指针。 */
valp = bpf_map_lookup_elem(&xdp_stats_map, &key);

/* 如果没有接口的记录，我们需要创建一个，
 * 数据包数 == 1
 */
if (!valp) {
	__u64 one = 1;
	return bpf_map_update_elem(&xdp_stats_map, &key, &one, 0) ? 1 : 0;
}

(*valp)++;
```


请查看 trace_prog_kern.c 了解完整代码。

## 作业


### 作业 1：设置测试环境


在本课中，我们将使用前一课的设置：
Basic02 - 按名称加载程序 [https://github.com/xdp-project/xdp-tutorial/tree/master/basic02-prog-by-name#assignment-2-add-xdp_abort-program](https://github.com/xdp-project/xdp-tutorial/tree/master/basic02-prog-by-name#assignment-2-add-xdp_abort-program)

并从 xdp_prog_kern.o 加载 XDP 程序，它将中止每个传入的数据包：

```c
SEC("xdp_abort")
int xdp_drop_func(struct xdp_md *ctx)
{
        return XDP_ABORTED;
}
```


使用 xdp-loader：
作业 2：添加 xdp_abort 程序 [https://github.com/xdp-project/xdp-tutorial/tree/master/basic02-prog-by-name#assignment-2-add-xdp_abort-program](https://github.com/xdp-project/xdp-tutorial/tree/master/basic02-prog-by-name#assignment-2-add-xdp_abort-program)

设置环境：

```bash
$ sudo ../testenv/testenv.sh setup --name veth-basic02
```


加载产生中止数据包的 XDP 程序：

```bash
$ sudo xdp-loader load veth-basic02 xdp_prog_kern.o -n xdp_drop_func
```


并生成一些数据包：

```bash
$ sudo ../testenv/testenv.sh enter --name veth-basic02
# ping  fc00:dead:cafe:1::1
PING fc00:dead:cafe:1::1(fc00:dead:cafe:1::1) 56 data bytes
```


### 作业 2：加载跟踪点监控程序


现在当你运行 trace_load_and_stats 应用程序时，它将加载并附加
跟踪点 eBPF 程序，并显示每个接口的中止数据包数量：

```bash
# ./trace_load_and_stats
Success: Loaded BPF-object(trace_prog_kern.o)

Collecting stats from BPF map
 - BPF map (bpf_map_type:1) id:46 name:xdp_stats_map key_size:4 value_size:4 max_entries:10

veth-basic02 (2)
veth-basic02 (4)
veth-basic02 (6)
...
```


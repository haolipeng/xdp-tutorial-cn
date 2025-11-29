# 教程：Basic02 - 按名称加载程序


在本课中，你将看到由 LLVM 生成的 BPF ELF 文件可以包含多个 XDP 程序，
以及如何使用 **libxdp API** 选择要加载的程序。完成下面的每个作业以完成本课。

- [使用 libxdp 和 libbpf](#使用-libxdp-和-libbpf)
  - [创建 XDP 程序](#创建-xdp-程序)
  - [硬件卸载](#硬件卸载)
- [作业](#作业)
  - [作业 1：设置测试环境](#作业-1-设置测试环境)
  - [作业 2：添加 xdp_abort 程序](#作业-2-添加-xdp_abort-程序)

## 使用 libxdp 和 libbpf


libbpf API 不仅提供基本的系统调用包装器（定义在 libbpf 的
[bpf/bpf.h](https://github.com/libbpf/libbpf/blob/master/src/bpf.h) 中）。该 API 还提供"[对象](https://libbpf.readthedocs.io/en/latest/libbpf_naming_convention.html#objects)"以及处理它们的函数
（定义在 [bpf/libbpf.h](https://github.com/libbpf/libbpf/blob/master/src/libbpf.h) 中）。

与 libbpf 对象对应的 C 结构体是：
 - struct `bpf_object`
 - struct `bpf_program`
 - struct `bpf_map`

这些结构体供 libbpf 内部使用，你必须使用 API 函数来与这些不透明对象交互。
处理对象的函数以结构体名称命名，后跟双下划线和描述性名称。

libxdp API 提供了用于处理 XDP 程序的对象和函数，以及用于处理 AF_XDP
套接字的对象和函数，定义在 [xdp/libxdp.h](https://github.com/xdp-project/xdp-tools/blob/master/headers/xdp/libxdp.h) 中。

与 libxdp 对象对应的 C 结构体是：
 - struct `xdp_program`
 - struct `xdp_multiprog`
 - struct `xsk_umem`
 - struct `xsk_socket`

让我们看看 libxdp 和 libbpf 的实际用法。

### 创建 XDP 程序


在 [xdp_loader.c](xdp_loader.c) 中，函数 `xdp_program__create()` 用于创建
`xdp_program` 对象，在本例中是通过从 ELF 文件加载程序。结构体
`xdp_program` 表示可以配置并附加到 XDP 钩子的单个 XDP 程序。

我们使用 `filename` 和 `progname` 来识别要从 ELF 文件创建的 XDP 程序，
通过使用结构体 `xdp_program_opts`：

```C
DECLARE_LIBBPF_OPTS(bpf_object_open_opts, opts);
DECLARE_LIBXDP_OPTS(xdp_program_opts, xdp_opts,
        .open_filename = cfg->filename,
        .prog_name = cfg->progname,
        .opts = &opts);
```


当从 ELF 文件创建 `xdp_program` 时，它会保留对底层 `bpf_object` 的引用，
可以用来访问 ELF 文件中的所有 BPF 程序和映射。我们可以使用函数
`xdp_program__bpf_obj(prog)` 从 `xdp_program` 获取 `bpf_object`。

### 硬件卸载


XDP 也可以卸载到 NIC 硬件中运行（在一些支持卸载的 NIC 上）。

XDP 标志 XDP_FLAGS_HW_MODE 启用（请求）硬件卸载，通过长选项 `--offload-mode`
设置。[加载器代码](file:xdp_loader.c) 还需要使用更高级的 libbpf API 调用
`bpf_prog_load_xattr()`，它允许我们设置 ifindex，因为这在加载时需要以
启用硬件卸载。

关于如何在 Netronome 的 Agilio SmartNIC 上使硬件卸载工作的一些详细信息
在 [xdp_offload_nfp](xdp_offload_nfp.md) 中；例如，固件需要更新以支持 eBPF。

## 作业


### 作业 1：设置测试环境


由于本课涉及加载和选择一个简单丢弃所有数据包的 XDP 程序（通过动作
`XDP_DROP`），你需要将其加载到真实接口上以观察发生的情况。为此，我们
建立一个测试实验室环境。在 [testenv/](file:../testenv/) 目录中，你会找到一个脚本
`testenv.sh`，它帮助你设置基于 `veth` 设备和网络命名空间的测试实验室。

例如，像这样运行脚本：
```sh
$ sudo ../testenv/testenv.sh setup --name veth-basic02
Setting up new environment 'veth-basic02'
Setup environment 'veth-basic02' with peer ip fc00:dead:cafe:1::2.
```


这将创建一个名为 `veth-basic02` 的（外部）接口。你可以通过 ping 对等
IPv6 地址 `fc00:dead:cafe:1::2`（如脚本输出所示）来测试环境网络是否正常运行。

*作业* 是使用此目录中的 `xdp_loader` 程序手动加载 ELF OBJ 文件
`xdp_prog_kern.o` 中编译的 xdp 程序。通过 `--help` 观察可以给 xdp_loader
的可用选项。尝试通过 `--progname` 选择名为 `xdp_drop_func` 的程序，
并通过 ping 观察数据包被丢弃。

以下是一些示例命令：
```sh
sudo ./xdp_loader --help
sudo ./xdp_loader --dev veth-basic02
sudo ./xdp_loader --dev veth-basic02 --unload-all
sudo ./xdp_loader --dev veth-basic02 --progname xdp_drop_func
sudo ./xdp_loader --dev veth-basic02 --progname xdp_pass_func
```


#### 关于测试环境和 veth 数据包方向的说明


当你在主机上可见的接口上加载 XDP 程序时，它将对到达该接口的所有数据包
进行操作。由于从 veth 对中的一个接口发送的数据包将到达另一端，你的 XDP
程序将看到的数据包是从网络命名空间（netns）**内部** 发送的。这意味着在
测试时，你应该从脚本创建的网络命名空间 **内部** 进行 ping。

你可以手动"进入"命名空间（通过 `sudo ip netns exec veth-basic02 /bin/bash`）
或通过脚本：
```bash
$ sudo ../testenv/testenv.sh enter --name veth-basic02
# ping fc00:dead:cafe:1::1
```


为了使这个 ping 连通性测试更容易，脚本还有一个 `ping` 命令，从 netns
内部进行 ping：
```bash
$ sudo ../testenv/testenv.sh ping --name veth-basic02
```


你应该注意到，使用 netns 作为测试实验室的 **酷炫之处** 在于，即使当 XDP
正在丢弃所有数据包时，我们仍然可以"进入" netns。

#### 推荐：为 testenv.sh 创建别名


为了更快地访问 testenv.sh 脚本，我们建议你创建一个 shell 别名（称为 `t`）。
testenv 脚本甚至有一个用于此目的的命令助手：

```bash
$ ../testenv/testenv.sh alias
Eval this with `eval $(../testenv/testenv.sh alias)` to create shell alias
WARNING: Creating sudo alias; be careful, this script WILL execute arbitrary programs

alias t='sudo /home/fedora/git/xdp-tutorial/testenv/testenv.sh'
```


如指出的那样，运行：
```bash
eval $(../testenv/testenv.sh alias)
```


你现在应该能够以 `t <command>` 运行 testenv 命令（例如，`t ping`）。
后续所有示例都将使用此语法。

#### 便利：跳过环境名称


testenv 脚本会保存上次使用的 testenv 名称，所以在大多数情况下，运行脚本
时可以跳过 `--name` 参数。如果你在运行 `t setup` 时不指定名称，将为你
生成一个随机名称。

你可以同时拥有多个活动的测试环境，并且可以始终使用 `--name` 参数选择
特定的一个。运行 `t status` 查看当前选定的环境（即，如果你不使用 `--name`
指定环境时将使用的环境），以及所有当前活动环境的列表。

### 作业 2：添加 xdp_abort 程序


在 [xdp_prog_kern.c](xdp_prog_kern.c) 中添加一个新的程序节 "xdp_abort"，它使用（返回）
XDP 动作 `XDP_ABORTED`（并通过 `make` 编译）。加载这个新程序，例如类似于上面：

```sh
sudo ./xdp_loader --dev veth-basic02 --unload-all
sudo ./xdp_loader --dev veth-basic02 --progname xdp_abort_func
```


*课程*：XDP_ABORTED 与 XDP_DROP 不同，因为它会触发名为 `xdp:xdp_exception`
的跟踪点。

在从命名空间内部 ping 的同时，记录此跟踪点并观察这些记录。例如用 perf：

```sh
sudo perf record -a -e xdp:xdp_exception sleep 4
sudo perf script
```


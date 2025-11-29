# 教程：基础课程 - 解决方案


此目录包含
[basic01](file:../basic01-xdp-pass/)、
[basic02](file:../basic02-prog-by-name/)、
[basic03](file:../basic03-map-counter/) 和
[basic04](file:../basic04-pinning-maps/) 课程中所有作业的解决方案。

- [解决方案](#解决方案)
  - [Basic01：加载你的第一个 BPF 程序](#basic01-加载你的第一个-bpf-程序)
  - [Basic02：按名称加载程序](#basic02-按名称加载程序)
  - [Basic03：使用 BPF 映射计数](#basic03-使用-bpf-映射计数)
  - [Basic04：映射固定](#basic04-映射固定)

## 解决方案


### Basic01：加载你的第一个 BPF 程序


本课不包含任何作业，只需重复课程 readme 文件中列出的步骤。

### Basic02：按名称加载程序


#### 作业 1：设置测试环境


不需要代码，只需重复作业描述中列出的步骤。

#### 作业 2：添加 xdp_abort 程序


只需将以下节添加到 [xdp_prog_kern.c](file:../basic02-prog-by-name/xdp_prog_kern.c)
程序，并按照作业描述中列出的步骤操作：

```c
SEC("xdp_abort")
int  xdp_abort_func(struct xdp_md *ctx)
{
    return XDP_ABORTED;
}
```


### Basic03：使用 BPF 映射计数


所有三个作业的解决方案可以在以下文件中找到：

 * [common_kern_user.h](file:../basic04-pinning-maps/common_kern_user.h) 文件包含新的 `datarec` 结构定义。
 * [xdp_prog_kern.c](file:../basic04-pinning-maps/xdp_prog_kern.c) 文件包含新的 `xdp_stats_map` 映射定义和更新的 `xdp_stats_record_action` 函数。

请注意，为了在后续课程/作业中使用，代码已移动到以下文件：
[xdp_stats_kern_user.h](file:../common/xdp_stats_kern_user.h) 和
[xdp_stats_kern.h](file:../common/xdp_stats_kern.h)。因此，为了在后续 XDP 程序中使用
`xdp_stats_record_action` 函数，只需包含以下头文件：

```c
#include "../common/xdp_stats_kern_user.h"
#include "../common/xdp_stats_kern.h"
```


对于用户空间应用程序，只需要前一个头文件。

### Basic04：映射固定


#### 作业 1：(xdp_stats.c) 重新加载映射文件描述符


参见此目录中的 [xdp_stats.c](file:xdp_stats.c) 程序。

#### 作业 2：(xdp_loader.c) 重用固定的映射


参见此目录中的 [xdp_loader.c](file:xdp_loader.c) 程序。

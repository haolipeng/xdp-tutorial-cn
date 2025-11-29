# 教程：Basic04 - 映射固定


在本课中，你将学习如何从另一个"外部"程序读取 BPF 映射。

在 basic03 中，[xdp_load_and_stats.c](file:../basic03-map-counter/xdp_load_and_stats.c) 程序既加载 BPF 程序又从映射中
读取统计数据。这很实用，因为映射文件描述符可以随时获得；然而，映射
只能从加载它的同一程序访问这一点通常是有限制的。

在本课中，我们将把程序分成两个单独的程序：
 - 一个专注于 BPF/XDP 加载（[xdp_loader.c](xdp_loader.c)）
 - 一个专注于读取和打印统计数据（[xdp_stats.c](xdp_stats.c)）

基本的问题围绕着如何从创建映射的程序之外的另一个程序共享或获取
指向 BPF 映射的 UNIX 文件描述符。

- [basic03 作业的解决方案](#basic03-作业的解决方案)
- [本课你将学到的内容](#本课你将学到的内容)
  - [bpf 系统调用包装器](#bpf-系统调用包装器)
  - [挂载 BPF 文件系统](#挂载-bpf-文件系统)
  - [固定映射的注意事项](#固定映射的注意事项)
  - [XDP 重新加载时删除映射](#xdp-重新加载时删除映射)
- [作业](#作业)
  - [作业 1：(xdp_stats.c) 重新加载映射文件描述符](#作业-1-xdp_statsc-重新加载映射文件描述符)
  - [作业 2：(xdp_loader.c) 重用固定的映射](#作业-2-xdp_loaderc-重用固定的映射)

## basic03 作业的解决方案


[basic03](file:../basic03-map-counter) 中的作业已在此 basic04 课程中"解决"或实现。因此，这可以作为
basic03 的参考解决方案。

## 本课你将学到的内容


### bpf 系统调用包装器


在将 [xdp_load_and_stats.c](file:../basic03-map-counter/xdp_load_and_stats.c) 程序分成 [xdp_loader.c](xdp_loader.c) 和 [xdp_stats.c](xdp_stats.c) 时，
注意 xdp_stats.c 不再包含 `#<xdp/libxdp.h>`。这是因为 xdp_stats 不使用
任何高级的 libbpf "对象"相关函数，它只使用基本的 bpf 系统调用包装器，
libbpf 也提供这些。

bpf 系统调用包装器由 libbpf 通过 `#<bpf/bpf.h>` 头文件提供，对于此教程
设置位于 `../libbpf/src/root/usr/include/bpf/bpf.h`（但也请参见
[libbpf github 仓库中的源 bpf.h](https://github.com/libbpf/libbpf/blob/master/src/bpf.h)）。

这里的重点是 libbpf 将低级 bpf 系统调用包装器保存在单独的文件 [bpf.h](https://github.com/libbpf/libbpf/blob/master/src/bpf.h) 和
[bpf.c](https://github.com/libbpf/libbpf/blob/master/src/bpf.c) 中。因此，我们可以通过不与 libbpf.a 链接来缩小二进制文件的大小。
但是，为了便于使用，在本教程中我们只是将所有内容与完整库链接。

### 挂载 BPF 文件系统


用于在程序之间共享 BPF 映射的机制称为 /固定/。这意味着我们在挂载于
`/sys/fs/bpf/` 的特殊文件系统下为每个映射创建一个文件。如果此文件系统
未挂载，我们固定 BPF 对象的尝试将失败，所以我们需要确保它已挂载。

所需的挂载命令是：
```bash
 mount -t bpf bpf /sys/fs/bpf/
```


如果你按照教程进行，你可能已经在不知不觉中挂载了它。因为 iproute2 的 'ip'
和我们的 [testenv](file:../testenv) 都会自动将其挂载到 `/sys/fs/bpf/` 下的默认位置。
如果没有，使用上面的命令挂载它。

### 固定映射的注意事项


使用 libbpf 固定 `bpf_object` 中的所有映射很容易：
`bpf_object__pin_maps(bpf_object, pin_dir)`，我们在 `xdp_loader` 中使用它。

为避免文件名冲突，我们创建一个以加载 BPF 程序的接口命名的子目录。
libbpf 的 `bpf_object__pin_maps()` 调用甚至会处理创建此子目录（如果它不存在）。

但是，如果你打开 [xdp_loader.c](xdp_loader.c) 并查看我们的函数 `pin_maps_in_bpf_object()`，
你会看到由于边缘情况，事情稍微复杂一些。例如，我们还需要处理清理
未清理其映射的先前 XDP 程序，我们选择通过 `bpf_object__unpin_maps()` 来做。
如果这是第一次使用，那么我们不应该尝试"取消固定映射"，因为那会失败。

有一个我们目前没有处理的边缘情况，即我们的 BPF 程序用新映射扩展，
并作为不包含此新映射的现有 BPF 程序的替换加载。在这种情况下，
`bpf_object__unpin_maps()` 找不到要取消链接的新映射，因此操作会失败。

### XDP 重新加载时删除映射


通过我们的 `xdp_loader` 重新加载 XDP BPF 程序时，不会重用现有的固定映射。
这与 iproute2 工具 BPF 加载器（`ip` 和 `tc` 命令）不同，它会重用现有的
固定映射，而不是创建新映射。

这是一个设计选择，主要因为 libbpf 没有对此的简单支持，但也因为计数器
重置为零更容易观察我们的程序是否工作。可以很容易想象，对于实际应用来说，
计数器为不同的统计工具重置为零可能是个问题。即使对于我们分开的
`xdp_stats` 程序来说也很烦人，因为你必须记住在通过 `xdp_loader` 重新加载后
重新启动 `xdp_stats` 工具，否则它将监视错误的 FD。
（参见 [作业 1](#assignment1-xdp_statsc-reload-map-file-descriptor) 了解解决方法）

#### 使用 libbpf 重用映射


有时你希望多个 XDP 程序共享同一个映射
（例如，固定在 /sys/fs/bpf/… 中的统计映射）。
libbpf API 提供了一种方法来 **重用并替换** BPF 对象内部的映射为
已存在的固定映射，使用：

`bpf_map__reuse_fd()`

此调用必须在对象通过 `bpf_object__open()` 打开 **之后**，但在通过
`bpf_object__load()` 加载 **之前** 进行。

当使用更高级的 XDP 程序 API 时：

- `xdp_program__create()` → 内部调用 `bpf_object__open()`
- `xdp_program__attach()` → 内部调用 `bpf_object__load()`

因此，你需要在两者之间注入 `bpf_map__reuse_fd()` 步骤，
通过从 XDP 程序获取底层 `bpf_object`。

这是一个最小示例：

```c
struct xdp_program *prog;
struct bpf_object *bpf_obj;
struct bpf_map *map;
int pinned_map_fd;

/* 1. 创建程序（打开 bpf_object） */
prog = xdp_program__create(&xdp_opts);

/* 2. 访问底层 bpf_object */
bpf_obj = xdp_program__bpf_obj(prog);

/* 3. 在对象中查找映射 */
map = bpf_object__find_map_by_name(bpf_obj, "xdp_stats_map");

/* 4. 获取固定映射的 FD */
pinned_map_fd = bpf_obj_get("/sys/fs/bpf/veth0/xdp_stats_map");

/* 5. 重用固定的 FD 而不是创建新映射 */
bpf_map__reuse_fd(map, pinned_map_fd);

/* 6. 现在附加程序（这将加载对象） */
xdp_program__attach(prog, ifindex, attach_mode, 0);
```


（提示：参见 [作业 2](#assignment2-xdp_loaderc-reuse-pinned-map)）

## 作业


### 作业 1：(xdp_stats.c) 重新加载映射文件描述符


如上所述，`xdp_stats` 工具不会检测 `xdp_loader` 是否加载了新映射和新 BPF
程序，需要重新启动。这很烦人。**作业** 是动态重新加载映射文件描述符，
这样 `xdp_stats` 程序就不需要重新启动。

有几种解决方案。简单的解决方案是每次重新打开固定的映射文件；但你如何
检测文件是否已更改？如果你没有检测到在处理新映射，那么两次测量之间的
统计差值将为负。考虑使用 ID 号来检测更改的解决方案，可以通过映射 ID
或 XDP BPF 程序 ID。

### 作业 2：(xdp_loader.c) 重用固定的映射


如上所述，libbpf 可以重用并用现有映射替换映射。

*作业* 是在 [xdp_loader](file:xdp_loader.c) 中检查是否已经有固定版本的映射 "xdp_stats_map"，
并使用 libbpf 的 `bpf_map__reuse_fd()` API 来重用它，而不是创建新映射。

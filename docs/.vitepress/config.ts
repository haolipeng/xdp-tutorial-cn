import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'XDP 教程中文版',
  description: 'XDP 编程实战教程 - 中文翻译',
  lang: 'zh-CN',
  base: '/xdp-tutorial-cn/',

  // Ignore dead links to source code files
  ignoreDeadLinks: [
    /\.c$/,
    /\.h$/,
    /xdp_offload_nfp/
  ],

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '快速开始', link: '/basic01-xdp-pass/' },
      { text: 'GitHub', link: 'https://github.com/haolipeng/xdp-tutorial-cn' }
    ],

    sidebar: [
      {
        text: '入门',
        items: [
          { text: '简介', link: '/' },
          { text: '安装依赖', link: '/setup_dependencies' },
          { text: '测试环境', link: '/testenv/' }
        ]
      },
      {
        text: '基础教程',
        items: [
          { text: 'Basic01 - 加载第一个 BPF 程序', link: '/basic01-xdp-pass/' },
          { text: 'Basic02 - 按名称加载程序', link: '/basic02-prog-by-name/' },
          { text: 'Basic03 - Map 计数器', link: '/basic03-map-counter/' },
          { text: 'Basic04 - Pinning Maps', link: '/basic04-pinning-maps/' },
          { text: '基础教程答案', link: '/basic-solutions/' }
        ]
      },
      {
        text: '数据包处理',
        items: [
          { text: 'Packet01 - 数据包解析', link: '/packet01-parsing/' },
          { text: 'Packet02 - 数据包重写', link: '/packet02-rewriting/' },
          { text: 'Packet03 - 数据包重定向', link: '/packet03-redirecting/' },
          { text: '数据包教程答案', link: '/packet-solutions/' }
        ]
      },
      {
        text: '追踪调试',
        items: [
          { text: 'Tracing01 - 简单追踪', link: '/tracing01-xdp-simple/' },
          { text: 'Tracing02 - XDP 监控', link: '/tracing02-xdp-monitor/' },
          { text: 'Tracing03 - Debug 打印', link: '/tracing03-xdp-debug-print/' },
          { text: 'Tracing04 - XDP tcpdump', link: '/tracing04-xdp-tcpdump/' }
        ]
      },
      {
        text: '高级主题',
        items: [
          { text: 'Advanced01 - XDP 与 TC 交互', link: '/advanced01-xdp-tc-interact/' },
          { text: 'Advanced03 - AF_XDP', link: '/advanced03-AF_XDP/' }
        ]
      },
      {
        text: '其他',
        items: [
          { text: '实验01 - Tail Grow', link: '/experiment01-tailgrow/' },
          { text: '通用组件', link: '/common/' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/haolipeng/xdp-tutorial-cn' }
    ],

    footer: {
      message: 'XDP Tutorial 中文翻译版',
      copyright: '基于 xdp-project/xdp-tutorial 翻译'
    },

    search: {
      provider: 'local'
    },

    outline: {
      label: '页面导航',
      level: [2, 3]
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    lastUpdated: {
      text: '最后更新于'
    }
  }
})

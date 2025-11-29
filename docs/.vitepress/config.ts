import { defineConfig } from 'vitepress'
import { createWriteStream } from 'fs'
import { resolve } from 'path'
import { SitemapStream } from 'sitemap'

const links: { url: string; lastmod?: Date }[] = []

export default defineConfig({
  title: 'XDP 教程中文版',
  description: 'XDP 编程实战教程 - Linux 内核高性能数据包处理技术中文翻译教程',
  lang: 'zh-CN',
  base: '/xdp-tutorial-cn/',

  // Ignore dead links to source code files
  ignoreDeadLinks: [
    /\.c$/,
    /\.h$/,
    /xdp_offload_nfp/
  ],

  // SEO 优化
  head: [
    ['link', { rel: 'icon', href: '/xdp-tutorial-cn/favicon.ico' }],
    ['meta', { name: 'author', content: 'haolipeng' }],
    ['meta', { name: 'keywords', content: 'XDP, eBPF, BPF, Linux, 网络编程, 数据包处理, 高性能, 教程, 中文' }],

    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'XDP 教程中文版' }],
    ['meta', { property: 'og:description', content: 'XDP 编程实战教程 - Linux 内核高性能数据包处理技术' }],
    ['meta', { property: 'og:url', content: 'https://haolipeng.github.io/xdp-tutorial-cn/' }],
    ['meta', { property: 'og:site_name', content: 'XDP 教程中文版' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],

    // Twitter Card
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'XDP 教程中文版' }],
    ['meta', { name: 'twitter:description', content: 'XDP 编程实战教程 - Linux 内核高性能数据包处理技术' }],

    // 其他 SEO
    ['meta', { name: 'robots', content: 'index, follow' }],
    ['link', { rel: 'canonical', href: 'https://haolipeng.github.io/xdp-tutorial-cn/' }],
  ],

  // 最后更新时间
  lastUpdated: true,

  // Sitemap 生成
  transformHtml: (_, id, { pageData }) => {
    if (!/[\\/]404\.html$/.test(id)) {
      links.push({
        url: pageData.relativePath.replace(/((^|\/)index)?\.md$/, '$2'),
        lastmod: pageData.lastUpdated ? new Date(pageData.lastUpdated) : undefined
      })
    }
  },

  buildEnd: async ({ outDir }) => {
    const sitemap = new SitemapStream({
      hostname: 'https://haolipeng.github.io/xdp-tutorial-cn/'
    })
    const writeStream = createWriteStream(resolve(outDir, 'sitemap.xml'))
    sitemap.pipe(writeStream)
    links.forEach((link) => sitemap.write(link))
    sitemap.end()
    await new Promise((resolve) => writeStream.on('finish', resolve))
  },

  themeConfig: {
    // Logo
    logo: '/logo.svg',
    siteTitle: 'XDP 教程',

    nav: [
      { text: '首页', link: '/' },
      { text: '快速开始', link: '/basic01-xdp-pass/' },
      {
        text: '教程',
        items: [
          { text: '基础教程', link: '/basic01-xdp-pass/' },
          { text: '数据包处理', link: '/packet01-parsing/' },
          { text: '追踪调试', link: '/tracing01-xdp-simple/' },
          { text: '高级主题', link: '/advanced01-xdp-tc-interact/' }
        ]
      },
      { text: 'GitHub', link: 'https://github.com/haolipeng/xdp-tutorial-cn' }
    ],

    sidebar: [
      {
        text: '入门',
        collapsed: false,
        items: [
          { text: '简介', link: '/' },
          { text: '安装依赖', link: '/setup_dependencies' },
          { text: '测试环境', link: '/testenv/' }
        ]
      },
      {
        text: '基础教程',
        collapsed: false,
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
        collapsed: false,
        items: [
          { text: 'Packet01 - 数据包解析', link: '/packet01-parsing/' },
          { text: 'Packet02 - 数据包重写', link: '/packet02-rewriting/' },
          { text: 'Packet03 - 数据包重定向', link: '/packet03-redirecting/' },
          { text: '数据包教程答案', link: '/packet-solutions/' }
        ]
      },
      {
        text: '追踪调试',
        collapsed: true,
        items: [
          { text: 'Tracing01 - 简单追踪', link: '/tracing01-xdp-simple/' },
          { text: 'Tracing02 - XDP 监控', link: '/tracing02-xdp-monitor/' },
          { text: 'Tracing03 - Debug 打印', link: '/tracing03-xdp-debug-print/' },
          { text: 'Tracing04 - XDP tcpdump', link: '/tracing04-xdp-tcpdump/' }
        ]
      },
      {
        text: '高级主题',
        collapsed: true,
        items: [
          { text: 'Advanced01 - XDP 与 TC 交互', link: '/advanced01-xdp-tc-interact/' },
          { text: 'Advanced03 - AF_XDP', link: '/advanced03-AF_XDP/' }
        ]
      },
      {
        text: '其他',
        collapsed: true,
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
      message: '基于 <a href="https://github.com/xdp-project/xdp-tutorial">xdp-project/xdp-tutorial</a> 翻译',
      copyright: 'Copyright © 2024 haolipeng'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
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
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    },

    // 编辑链接
    editLink: {
      pattern: 'https://github.com/haolipeng/xdp-tutorial-cn/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    // 返回顶部
    returnToTopLabel: '返回顶部',

    // 外观切换
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式'
  }
})

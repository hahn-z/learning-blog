import { defineConfig } from 'vitepress'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = join(__dirname, '..')

interface SidebarItem {
  text: string
  link?: string
  items?: SidebarItem[]
  collapsed?: boolean
}

// Tech stacks mapping: dir -> display name
const TECH_STACKS: [string, string][] = [
  ['Golang', 'Go 语言'],
  ['PHP', 'PHP 语言'],
  ['Python', 'Python'],
  ['Node.js', 'Node.js'],
  ['JavaScript', 'JavaScript'],
  ['TypeScript', 'TypeScript'],
  ['Vue.js', 'Vue.js'],
  ['Hyperf', 'Hyperf'],
  ['Swoole', 'Swoole'],
  ['HTML-CSS', 'HTML/CSS'],
  ['其他', '其他'],
]

/**
 * Recursively scan directory for .md files and build sidebar items
 */
function scanDir(dir: string, basePath: string): SidebarItem[] {
  const items: SidebarItem[] = []
  const entries = readdirSync(dir).sort()

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (entry.startsWith('.') || entry === 'index.md') continue

    if (stat.isDirectory()) {
      // Check if directory has .md files directly or sub-dirs
      const subItems = scanDir(fullPath, `${basePath}/${entry}`)
      if (subItems.length > 0) {
        // Use folder name as group title (clean up number prefix)
        const cleanName = entry.replace(/^\d+-/, '').replace(/-/g, ' ')
        items.push({
          text: cleanName,
          collapsed: false,
          items: subItems,
        })
      }
    } else if (entry.endsWith('.md')) {
      const content = readFileSync(fullPath, 'utf-8')
      const m = content.match(/^title:\s*["']?(.+?)["']?\s*$/m)
      // Extract title: prefer frontmatter, then first heading, then filename
      let text = m ? m[1].trim() : ''
      if (!text || text.match(/^\d+\s*-/)) {
        const h1 = content.match(/^#\s+(.+)$/m)
        text = h1 ? h1[1].trim() : basename(entry, '.md')
      }
      // Clean up "001 - " prefix from titles
      text = text.replace(/^\d+\s*-\s*/, '')
      items.push({
        text,
        link: `${basePath}/${basename(entry, '.md')}`,
      })
    }
  }
  return items
}

/**
 * Build sidebar for a tech stack directory
 */
function techSidebar(techDir: string, techName: string): SidebarItem {
  const dir = join(DOCS_DIR, techDir)
  const items = scanDir(dir, `/${techDir}`)

  return {
    text: techName,
    collapsed: false,
    items: [
      { text: `${techName} 总览`, link: `/${techDir}/` },
      ...items,
    ],
  }
}

// Build sidebar for each tech stack
const sidebar: Record<string, SidebarItem[]> = {}
for (const [dir, name] of TECH_STACKS) {
  const fullDir = join(DOCS_DIR, dir)
  try {
    statSync(fullDir)
    sidebar[`/${dir}/`] = [techSidebar(dir, name)]
  } catch {
    // Directory doesn't exist, skip
  }
}

export default defineConfig({
  title: 'Hahn 技术博客',
  description: '全栈开发技术博客 — Golang / PHP / Python / Vue.js / 微服务 / K8S',
  lang: 'zh-CN',
  base: '/learning-blog/',

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: '首页', link: '/' },
      { text: 'Golang', link: '/Golang/' },
      { text: 'PHP', link: '/PHP/' },
      { text: 'Python', link: '/Python/' },
      { text: 'Vue.js', link: '/Vue.js/' },
      { text: 'Hyperf', link: '/Hyperf/' },
      { text: 'Swoole', link: '/Swoole/' },
      {
        text: '更多',
        items: TECH_STACKS.filter(([dir]) => !['Golang', 'PHP', 'Python', 'Vue.js', 'Hyperf', 'Swoole'].includes(dir))
          .map(([dir, name]) => ({ text: name, link: `/${dir}/` })),
      },
    ],

    sidebar,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/hahn-z/learning-blog' },
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索文章', buttonAriaLabel: '搜索文章' },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
        },
      },
    },

    footer: {
      message: '基于 CC BY-NC-SA 4.0 发布',
      copyright: '© 2024-present Hahn',
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    outline: {
      label: '本章目录',
      level: [2, 3],
    },

    editLink: {
      pattern: 'https://github.com/hahn-z/learning-blog/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    lastUpdated: {
      text: '最后更新于',
    },
  },

  lastUpdated: true,
})

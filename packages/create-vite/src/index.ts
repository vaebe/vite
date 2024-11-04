import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import spawn from 'cross-spawn'
import minimist from 'minimist'
import prompts from 'prompts'
import colors from 'picocolors'

// 解构颜色函数用于命令行输出着色
const {
  blue,
  blueBright,
  cyan,
  green,
  greenBright,
  magenta,
  red,
  redBright,
  reset,
  yellow,
} = colors

// 使用 minimist 解析命令行参数时,避免将项目名称自动转换为数字
// 通过指定 string: ['_'] 确保非选项参数(即 _ 数组)被解析为字符串
// 为了修复 #4606 issue:当项目名称是纯数字时会被错误转换为数字类型
const argv = minimist<{
  template?: string
  help?: boolean
}>(process.argv.slice(2), {
  default: { help: false },
  alias: { h: 'help', t: 'template' },
  string: ['_'],
})

// 获取当前工作目录路径
const cwd = process.cwd()

// prettier-ignore
// 提示信息
const helpMessage = `\
Usage: create-vite [OPTION]... [DIRECTORY]

Create a new Vite project in JavaScript or TypeScript.
With no arguments, start the CLI in interactive mode.

Options:
  -t, --template NAME        use a specific template

Available templates:
${yellow    ('vanilla-ts     vanilla'  )}
${green     ('vue-ts         vue'      )}
${cyan      ('react-ts       react'    )}
${cyan      ('react-swc-ts   react-swc')}
${magenta   ('preact-ts      preact'   )}
${redBright ('lit-ts         lit'      )}
${red       ('svelte-ts      svelte'   )}
${blue      ('solid-ts       solid'    )}
${blueBright('qwik-ts        qwik'     )}`

type ColorFunc = (str: string | number) => string

// 定义框架和变体的类型
type Framework = {
  name: string // 框架名称
  display: string // 显示名称
  color: ColorFunc // 颜色函数
  variants: FrameworkVariant[] // 框架变体数组
}

type FrameworkVariant = {
  name: string // 变体名称
  display: string // 显示名称
  color: ColorFunc // 颜色函数
  customCommand?: string // 自定义命令（可选）
}

// 框架配置
const FRAMEWORKS: Framework[] = [
  {
    name: 'vanilla',
    display: 'Vanilla',
    color: yellow,
    variants: [
      {
        name: 'vanilla-ts',
        display: 'TypeScript',
        color: blue,
      },
      {
        name: 'vanilla',
        display: 'JavaScript',
        color: yellow,
      },
    ],
  },
  {
    name: 'vue',
    display: 'Vue',
    color: green,
    variants: [
      {
        name: 'vue-ts',
        display: 'TypeScript',
        color: blue,
      },
      {
        name: 'vue',
        display: 'JavaScript',
        color: yellow,
      },
      {
        name: 'custom-create-vue',
        display: 'Customize with create-vue ↗',
        color: green,
        customCommand: 'npm create vue@latest TARGET_DIR',
      },
      {
        name: 'custom-nuxt',
        display: 'Nuxt ↗',
        color: greenBright,
        customCommand: 'npm exec nuxi init TARGET_DIR',
      },
    ],
  },
  {
    name: 'react',
    display: 'React',
    color: cyan,
    variants: [
      {
        name: 'react-ts',
        display: 'TypeScript',
        color: blue,
      },
      {
        name: 'react-swc-ts',
        display: 'TypeScript + SWC',
        color: blue,
      },
      {
        name: 'react',
        display: 'JavaScript',
        color: yellow,
      },
      {
        name: 'react-swc',
        display: 'JavaScript + SWC',
        color: yellow,
      },
      {
        name: 'custom-remix',
        display: 'Remix ↗',
        color: cyan,
        customCommand: 'npm create remix@latest TARGET_DIR',
      },
    ],
  },
  {
    name: 'preact',
    display: 'Preact',
    color: magenta,
    variants: [
      {
        name: 'preact-ts',
        display: 'TypeScript',
        color: blue,
      },
      {
        name: 'preact',
        display: 'JavaScript',
        color: yellow,
      },
      {
        name: 'custom-create-preact',
        display: 'Customize with create-preact ↗',
        color: magenta,
        customCommand: 'npm create preact@latest TARGET_DIR',
      },
    ],
  },
  {
    name: 'lit',
    display: 'Lit',
    color: redBright,
    variants: [
      {
        name: 'lit-ts',
        display: 'TypeScript',
        color: blue,
      },
      {
        name: 'lit',
        display: 'JavaScript',
        color: yellow,
      },
    ],
  },
  {
    name: 'svelte',
    display: 'Svelte',
    color: red,
    variants: [
      {
        name: 'svelte-ts',
        display: 'TypeScript',
        color: blue,
      },
      {
        name: 'svelte',
        display: 'JavaScript',
        color: yellow,
      },
      {
        name: 'custom-svelte-kit',
        display: 'SvelteKit ↗',
        color: red,
        customCommand: 'npm exec sv create TARGET_DIR',
      },
    ],
  },
  {
    name: 'solid',
    display: 'Solid',
    color: blue,
    variants: [
      {
        name: 'solid-ts',
        display: 'TypeScript',
        color: blue,
      },
      {
        name: 'solid',
        display: 'JavaScript',
        color: yellow,
      },
    ],
  },
  {
    name: 'qwik',
    display: 'Qwik',
    color: blueBright,
    variants: [
      {
        name: 'qwik-ts',
        display: 'TypeScript',
        color: blueBright,
      },
      {
        name: 'qwik',
        display: 'JavaScript',
        color: yellow,
      },
      {
        name: 'custom-qwik-city',
        display: 'QwikCity ↗',
        color: blueBright,
        customCommand: 'npm create qwik@latest basic TARGET_DIR',
      },
    ],
  },
  {
    name: 'angular',
    display: 'Angular',
    color: red,
    variants: [
      {
        name: 'custom-angular',
        display: 'Angular ↗',
        color: red,
        customCommand: 'npm exec @angular/cli@latest new TARGET_DIR',
      },
      {
        name: 'custom-analog',
        display: 'Analog ↗',
        color: yellow,
        customCommand: 'npm create analog@latest TARGET_DIR',
      },
    ],
  },
  {
    name: 'others',
    display: 'Others',
    color: reset,
    variants: [
      {
        name: 'create-vite-extra',
        display: 'create-vite-extra ↗',
        color: reset,
        customCommand: 'npm create vite-extra@latest TARGET_DIR',
      },
      {
        name: 'create-electron-vite',
        display: 'create-electron-vite ↗',
        color: reset,
        customCommand: 'npm create electron-vite@latest TARGET_DIR',
      },
    ],
  },
]

/**
 * 所有可用的模板名称
 * 通过遍历 FRAMEWORKS 数组,将每个框架的变体名称提取出来
 * 最终得到一个包含所有模板名称的扁平数组
 * */
const TEMPLATES = FRAMEWORKS.map(
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name],
).reduce((a, b) => a.concat(b), [])

/**
 * 重命名文件映射表
 * 用于将特定文件名重命名为目标文件名
 * 例如: 将 _gitignore 重命名为 .gitignore
 * 因为某些文件系统不允许以 . 开头的文件名
 */
const renameFiles: Record<string, string | undefined> = {
  _gitignore: '.gitignore',
}

// 默认项目名称
const defaultTargetDir = 'vite-project'

/**
 * 初始化函数
 * 主要功能:
 * 1. 处理命令行参数
 *    - 获取目标目录参数(argTargetDir)
 *    - 获取模板参数(argTemplate)
 *    - 处理帮助命令(-h/--help)
 *
 * 2. 创建项目目录
 *    - 检查目标目录是否存在
 *    - 如果目录不为空,提供选项:清空或取消
 *    - 验证项目名称的合法性
 *
 * 3. 选择框架和变体
 *    - 如果未指定模板,提供交互式选择
 *    - 支持各种框架(Vue/React/Svelte等)
 *    - 支持 JavaScript/TypeScript 变体
 *
 * 4. 生成项目文件
 *    - 复制模板文件到目标目录
 *    - 处理特殊文件的重命名(.gitignore等)
 *    - 更新 package.json 配置
 *
 * 5. 安装依赖(可选)
 *    - 检测包管理器(npm/yarn/pnpm)
 *    - 执行依赖安装命令
 *
 * 6. 输出使用说明
 *    - 显示后续步骤指引
 *    - 提供启动开发服务器的命令
 */

async function init() {
  // 获取并格式化目标目录参数
  const argTargetDir = formatTargetDir(argv._[0])
  // 获取模板参数，支持 --template 或 -t 简写
  const argTemplate = argv.template || argv.t

  // 处理帮助命令
  const help = argv.help
  if (help) {
    console.log(helpMessage)
    return
  }

  // 设置目标目录，如果未指定则使用默认值
  let targetDir = argTargetDir || defaultTargetDir

  // 获取项目名称的函数：如果目标目录是当前目录(.)，则使用当前目录名，否则使用目标目录名
  const getProjectName = () =>
    targetDir === '.' ? path.basename(path.resolve()) : targetDir

  // 声明用于存储用户交互结果的变量
  let result: prompts.Answers<
    'projectName' | 'overwrite' | 'packageName' | 'framework' | 'variant'
  >

  // 设置命令行参数覆盖提示选项
  prompts.override({
    overwrite: argv.overwrite,
  })

  try {
    // 通过 prompts 进行交互式提示
    result = await prompts(
      [
        {
          // 项目名称提示
          // 如果命令行已指定目标目录则跳过此提示
          type: argTargetDir ? null : 'text',
          name: 'projectName',
          message: reset('Project name:'),
          initial: defaultTargetDir,
          onState: (state) => {
            targetDir = formatTargetDir(state.value) || defaultTargetDir
          },
        },
        {
          // 目录覆盖确认提示
          // 仅当目标目录存在且不为空时显示
          type: () =>
            !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'select',
          name: 'overwrite',
          message: () =>
            (targetDir === '.'
              ? 'Current directory'
              : `Target directory "${targetDir}"`) +
            ` is not empty. Please choose how to proceed:`,
          initial: 0,
          choices: [
            {
              title: 'Remove existing files and continue',
              value: 'yes',
            },
            {
              title: 'Cancel operation',
              value: 'no',
            },
            {
              title: 'Ignore files and continue',
              value: 'ignore',
            },
          ],
        },
        {
          // 覆盖确认检查
          // 如果用户选择取消，则抛出错误中断流程
          type: (_, { overwrite }: { overwrite?: string }) => {
            if (overwrite === 'no') {
              throw new Error(red('✖') + ' Operation cancelled')
            }
            return null
          },
          name: 'overwriteChecker',
        },
        {
          // 包名验证提示
          // 仅当项目名称不符合 package.json 命名规范时显示
          type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name:'),
          initial: () => toValidPackageName(getProjectName()),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name',
        },
        {
          // 框架选择提示
          // 如果命令行已指定有效模板则跳过此提示
          type:
            argTemplate && TEMPLATES.includes(argTemplate) ? null : 'select',
          name: 'framework',
          message:
            typeof argTemplate === 'string' && !TEMPLATES.includes(argTemplate)
              ? reset(
                  `"${argTemplate}" isn't a valid template. Please choose from below: `,
                )
              : reset('Select a framework:'),
          initial: 0,
          choices: FRAMEWORKS.map((framework) => {
            const frameworkColor = framework.color
            return {
              title: frameworkColor(framework.display || framework.name),
              value: framework,
            }
          }),
        },
        {
          // 框架变体选择提示
          // 仅当所选框架有变体选项时显示
          type: (framework: Framework) =>
            framework && framework.variants ? 'select' : null,
          name: 'variant',
          message: reset('Select a variant:'),
          choices: (framework: Framework) =>
            framework.variants.map((variant) => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.display || variant.name),
                value: variant.name,
              }
            }),
        },
      ],
      {
        // 用户取消操作时的处理
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled')
        },
      },
    )
  } catch (cancelled: any) {
    console.log(cancelled.message)
    return
  }

  // 用户的选择
  const { framework, overwrite, packageName, variant } = result

  const root = path.join(cwd, targetDir)

  /**
   * overwrite
   * yes: 删除现有文件并继续
   * no: 取消操作
   * ignore: 忽略文件并继续
   */
  if (overwrite === 'yes') {
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
  }

  // 确定模版
  let template: string = variant || framework?.name || argTemplate
  let isReactSwc = false
  // 如果选择的模版名称包含 -swc 则将  isReactSwc 设置为 true
  if (template.includes('-swc')) {
    isReactSwc = true
    template = template.replace('-swc', '')
  }

  // 解析包管理器信息
  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  // 使用的包管理器
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm'
  // yarn 目前有两个版本 1.x 和 2.x ，1.x的下载量高于 2.x
  const isYarn1 = pkgManager === 'yarn' && pkgInfo?.version.startsWith('1.')

  // 获取当前选择模版的自定义指令
  const { customCommand } =
    FRAMEWORKS.flatMap((f) => f.variants).find((v) => v.name === template) ?? {}

  // 如果自定义指令存在
  if (customCommand) {
    const fullCustomCommand = customCommand
      .replace(/^npm create /, () => {
        // 如果是 bun,使用 'bun x create-' 替换 'npm create'
        if (pkgManager === 'bun') {
          return 'bun x create-'
        }

        // 其他情况使用对应的包管理器
        return `${pkgManager} create `
      })
      // Yarn 1.x 不支持 @version 语法,需要移除 @latest 其他包管理器保留 @latest
      .replace('@latest', () => (isYarn1 ? '' : '@latest'))
      .replace(/^npm exec/, () => {
        // 替换执行命令
        if (pkgManager === 'pnpm') {
          return 'pnpm dlx'
        }
        if (pkgManager === 'yarn' && !isYarn1) {
          return 'yarn dlx'
        }
        if (pkgManager === 'bun') {
          return 'bun x'
        }

        // 在所有其他情况下使用 `npm exec`，包括 Yarn 1.x 和其他自定义 npm 客户端。
        return 'npm exec'
      })

    // 将自定义命令字符串拆分为命令和参数数组
    /**
     * 例如："npm create vue@latest TARGET_DIR" 会被拆分为：
     * command: "npm"
     * args: ["create", "vue@latest", "TARGET_DIR"]
     */
    const [command, ...args] = fullCustomCommand.split(' ')

    // 处理命令参数中的目标目录占位符
    // 因为目标目录名可能包含空格，所以在这里统一替换而不是在命令字符串中直接替换
    const replacedArgs = args.map((arg) =>
      // 将每个参数中的 TARGET_DIR 替换为实际的目标目录名
      arg.replace('TARGET_DIR', () => targetDir),
    )

    // 使用 spawn.sync 同步执行命令
    const { status } = spawn.sync(command, replacedArgs, {
      // stdio: 'inherit' 表示子进程将使用父进程的标准输入输出
      // 这样命令的输出会直接显示在控制台中
      stdio: 'inherit',
    })

    // 根据命令执行的状态码退出进程
    // 如果 status 为 null，则使用 0 作为退出码（表示成功）
    process.exit(status ?? 0)
  }

  console.log(`\nScaffolding project in ${root}...`)

  // 获取模板目录的绝对路径
  const templateDir = path.resolve(
    fileURLToPath(import.meta.url), // 将 import.meta.url 转换为文件路径
    '../..', // 向上两级目录
    `template-${template}`, // 拼接模板目录名
  )

  // 写入文件的工具函数
  const write = (file: string, content?: string) => {
    // 获取目标文件路径，如果文件需要重命名则使用重命名后的名称
    const targetPath = path.join(root, renameFiles[file] ?? file)
    if (content) {
      // 如果提供了内容，直接写入文件
      fs.writeFileSync(targetPath, content)
    } else {
      // 否则从模板目录复制文件
      copy(path.join(templateDir, file), targetPath)
    }
  }

  // 读取模板目录中的所有文件
  const files = fs.readdirSync(templateDir)
  // 复制除 package.json 外的所有文件到目标目录
  for (const file of files.filter((f) => f !== 'package.json')) {
    write(file)
  }

  // 单独处理 package.json
  const pkg = JSON.parse(
    fs.readFileSync(path.join(templateDir, `package.json`), 'utf-8'),
  )

  // 更新 package.json 中的项目名称
  pkg.name = packageName || getProjectName()

  // 写入更新后的 package.json
  write('package.json', JSON.stringify(pkg, null, 2) + '\n')

  // 如果使用 React SWC，设置相关配置
  if (isReactSwc) {
    setupReactSwc(root, template.endsWith('-ts'))
  }

  // 输出项目创建完成后的提示信息
  const cdProjectName = path.relative(cwd, root)
  console.log(`\nDone. Now run:\n`)

  // 如果项目不在当前目录，提示需要 cd 到项目目录
  if (root !== cwd) {
    // 如果路径包含空格，需要用引号包裹
    console.log(
      `  cd ${
        cdProjectName.includes(' ') ? `"${cdProjectName}"` : cdProjectName
      }`,
    )
  }

  // 根据包管理器输出不同的安装和启动命令
  switch (pkgManager) {
    case 'yarn':
      console.log('  yarn')
      console.log('  yarn dev')
      break
    default:
      // npm/pnpm 等其他包管理器
      console.log(`  ${pkgManager} install`)
      console.log(`  ${pkgManager} run dev`)
      break
  }
  console.log()
}

/**
 * 格式化目标目录名称
 * @param targetDir 目标目录名称
 * @returns 格式化后的目录名称
 * - 去除首尾空格
 * - 移除末尾的斜杠
 */
function formatTargetDir(targetDir: string | undefined) {
  return targetDir?.trim().replace(/\/+$/g, '')
}

/**
 * 复制文件或目录
 * @param src 源文件/目录路径
 * @param dest 目标文件/目录路径
 * - 如果是目录则调用 copyDir 进行递归复制
 * - 如果是文件则直接复制
 */
function copy(src: string, dest: string) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    fs.copyFileSync(src, dest)
  }
}

/**
 * 验证包名是否合法
 * @param projectName 项目名称
 * @returns boolean
 * 规则:
 * - 可以以 @ 开头(用于 scoped packages)
 * - 只能包含小写字母、数字、连字符、波浪号
 * - 不能以 . 或 _ 开头
 */
function isValidPackageName(projectName: string) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName,
  )
}

/**
 * 将项目名称转换为合法的包名
 * @param projectName 项目名称
 * @returns 合法的包名
 * 转换规则:
 * - 转为小写
 * - 空格替换为连字符
 * - 移除开头的 . 或 _
 * - 非法字符替换为连字符
 */
function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z\d\-~]+/g, '-')
}

/**
 * 递归复制目录
 * @param srcDir 源目录路径
 * @param destDir 目标目录路径
 * - 创建目标目录
 * - 遍历源目录下的所有文件和子目录
 * - 递归复制每个文件和子目录
 */
function copyDir(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    const destFile = path.resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

/**
 * 检查目录是否为空
 * @param path 目录路径
 * @returns boolean
 * - 完全空目录返回 true
 * - 只包含 .git 目录也返回 true
 */
function isEmpty(path: string) {
  const files = fs.readdirSync(path)
  return files.length === 0 || (files.length === 1 && files[0] === '.git')
}

/**
 * 清空目录内容
 * @param dir 要清空的目录路径
 * - 如果目录不存在则直接返回
 * - 保留 .git 目录
 * - 递归删除其他所有文件和目录
 */
function emptyDir(dir: string) {
  if (!fs.existsSync(dir)) {
    return
  }
  for (const file of fs.readdirSync(dir)) {
    if (file === '.git') {
      continue
    }
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true })
  }
}

/**
 * 从 user-agent 字符串中解析包管理器信息
 * @param userAgent npm_config_user_agent 环境变量值
 * @returns 包管理器名称和版本
 * 示例: "npm/6.14.8 node/v14.15.1 darwin x64" => { name: "npm", version: "6.14.8" }
 */
function pkgFromUserAgent(userAgent: string | undefined) {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1],
  }
}

/**
 * 配置 React SWC 支持
 * @param root 项目根目录
 * @param isTs 是否为 TypeScript 项目
 * - 替换 package.json 中的 plugin-react 为 plugin-react-swc
 * - 更新 vite.config 文件中的插件引用
 */
function setupReactSwc(root: string, isTs: boolean) {
  editFile(path.resolve(root, 'package.json'), (content) => {
    return content.replace(
      /"@vitejs\/plugin-react": ".+?"/,
      `"@vitejs/plugin-react-swc": "^3.5.0"`,
    )
  })
  editFile(
    path.resolve(root, `vite.config.${isTs ? 'ts' : 'js'}`),
    (content) => {
      return content.replace('@vitejs/plugin-react', '@vitejs/plugin-react-swc')
    },
  )
}

/**
 * 编辑文件内容
 * @param file 文件路径
 * @param callback 内容处理函数
 * - 读取文件内容
 * - 通过回调函数处理内容
 * - 将处理后的内容写回文件
 */
function editFile(file: string, callback: (content: string) => string) {
  const content = fs.readFileSync(file, 'utf-8')
  fs.writeFileSync(file, callback(content), 'utf-8')
}

init().catch((e) => {
  console.error(e)
})

import fs from 'node:fs'
import path from 'node:path'
import type { SyncOptions, SyncResult } from 'execa'
import { execaCommandSync } from 'execa'
import { afterEach, beforeAll, expect, test } from 'vitest'

// 定义 CLI 工具的根路径，指向项目根目录
const CLI_PATH = path.join(__dirname, '..')

// 测试项目的名称和生成路径配置
const projectName = 'test-app'
const genPath = path.join(__dirname, projectName)

// 封装命令执行函数
// 接收命令参数数组和可选的配置选项
// 返回命令执行的结果
const run = <SO extends SyncOptions>(
  args: string[],
  options?: SO,
): SyncResult<SO> => {
  return execaCommandSync(`node ${CLI_PATH} ${args.join(' ')}`, options)
}

// 创建非空目录的辅助函数
// 用于测试覆盖已存在目录的场景
const createNonEmptyDir = () => {
  // 创建测试目录
  fs.mkdirSync(genPath, { recursive: true })
  // 创建一个带有内容的 package.json 文件
  const pkgJson = path.join(genPath, 'package.json')
  fs.writeFileSync(pkgJson, '{ "foo": "bar" }')
}

// 获取 Vue 3 模板文件列表
// 读取模板目录下的所有文件，并处理特殊文件名
const templateFiles = fs
  .readdirSync(path.join(CLI_PATH, 'template-vue'))
  // 将 _gitignore 重命名为 .gitignore
  .map((filePath) => (filePath === '_gitignore' ? '.gitignore' : filePath))
  .sort()

// 测试钩子函数
// 在所有测试开始前清理测试目录
beforeAll(() => fs.rmSync(genPath, { recursive: true, force: true }))
// 每个测试结束后清理测试目录
afterEach(() => fs.rmSync(genPath, { recursive: true, force: true }))

// 测试用例：未提供项目名称时的提示
test('prompts for the project name if none supplied', () => {
  const { stdout } = run([])
  expect(stdout).toContain('Project name:')
})

// 测试用例：在当前目录下未指定框架时的提示
test('prompts for the framework if none supplied when target dir is current directory', () => {
  fs.mkdirSync(genPath, { recursive: true })
  const { stdout } = run(['.'], { cwd: genPath })
  expect(stdout).toContain('Select a framework:')
})

// 测试用例：未指定框架时的提示
test('prompts for the framework if none supplied', () => {
  const { stdout } = run([projectName])
  expect(stdout).toContain('Select a framework:')
})

// 测试用例：使用空的 --template 参数时的提示
test('prompts for the framework on not supplying a value for --template', () => {
  const { stdout } = run([projectName, '--template'])
  expect(stdout).toContain('Select a framework:')
})

// 测试用例：使用无效模板名称时的错误提示
test('prompts for the framework on supplying an invalid template', () => {
  const { stdout } = run([projectName, '--template', 'unknown'])
  expect(stdout).toContain(
    `"unknown" isn't a valid template. Please choose from below:`,
  )
})

// 测试用例：目标目录非空时的覆盖确认提示
test('asks to overwrite non-empty target directory', () => {
  createNonEmptyDir()
  const { stdout } = run([projectName], { cwd: __dirname })
  expect(stdout).toContain(`Target directory "${projectName}" is not empty.`)
})

// 测试用例：当前目录非空时的覆盖确认提示
test('asks to overwrite non-empty current directory', () => {
  createNonEmptyDir()
  const { stdout } = run(['.'], { cwd: genPath })
  expect(stdout).toContain(`Current directory is not empty.`)
})

// 测试用例：使用 Vue 启动模板成功创建项目
test('successfully scaffolds a project based on vue starter template', () => {
  const { stdout } = run([projectName, '--template', 'vue'], {
    cwd: __dirname,
  })
  const generatedFiles = fs.readdirSync(genPath).sort()

  // 验证输出信息和生成的文件
  expect(stdout).toContain(`Scaffolding project in ${genPath}`)
  expect(templateFiles).toEqual(generatedFiles)
})

// 测试用例：验证 -t 简写参数功能
test('works with the -t alias', () => {
  const { stdout } = run([projectName, '-t', 'vue'], {
    cwd: __dirname,
  })
  const generatedFiles = fs.readdirSync(genPath).sort()

  // 验证输出信息和生成的文件
  expect(stdout).toContain(`Scaffolding project in ${genPath}`)
  expect(templateFiles).toEqual(generatedFiles)
})

// 测试用例：验证 --overwrite 参数可以跳过覆盖确认
test('accepts command line override for --overwrite', () => {
  createNonEmptyDir()
  const { stdout } = run(['.', '--overwrite', 'ignore'], { cwd: genPath })
  expect(stdout).not.toContain(`Current directory is not empty.`)
})

// 测试用例：验证帮助信息显示
test('return help usage how to use create-vite', () => {
  const { stdout } = run(['--help'], { cwd: __dirname })
  const message = 'Usage: create-vite [OPTION]... [DIRECTORY]'
  expect(stdout).toContain(message)
})

// 测试用例：验证帮助信息简写命令
test('return help usage how to use create-vite with -h alias', () => {
  const { stdout } = run(['--h'], { cwd: __dirname })
  const message = 'Usage: create-vite [OPTION]... [DIRECTORY]'
  expect(stdout).toContain(message)
})

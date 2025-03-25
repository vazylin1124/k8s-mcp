// 创建自定义日志函数，使用标准错误输出
export const log = {
  info: (...args: any[]) => process.stderr.write(`\x1b[32m[INFO]\x1b[0m ${args.join(' ')}\n`),
  warn: (...args: any[]) => process.stderr.write(`\x1b[33m[WARN]\x1b[0m ${args.join(' ')}\n`),
  error: (...args: any[]) => process.stderr.write(`\x1b[31m[ERROR]\x1b[0m ${args.join(' ')}\n`)
}; 
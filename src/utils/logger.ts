// 创建自定义日志函数，使用标准错误输出
export const log = {
  info: (...args: any[]) => process.stderr.write(`[INFO] ${args.join(' ')}\n`),
  warn: (...args: any[]) => process.stderr.write(`[WARN] ${args.join(' ')}\n`),
  error: (...args: any[]) => process.stderr.write(`[ERROR] ${args.join(' ')}\n`),
  debug: (...args: any[]) => {
    if (process.env.DEBUG) {
      process.stderr.write(`[DEBUG] ${args.join(' ')}\n`);
    }
  }
}; 
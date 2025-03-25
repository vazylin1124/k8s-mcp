// 定义日志函数类型
type LogFunction = (...args: any[]) => void;

interface Logger {
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  debug: LogFunction;
}

// 创建自定义日志函数，使用标准错误输出
export const log: Logger = {
  info: (...args: any[]) => {
    process.stderr.write(`[INFO] ${args.join(' ')}\n`);
  },
  warn: (...args: any[]) => {
    process.stderr.write(`[WARN] ${args.join(' ')}\n`);
  },
  error: (...args: any[]) => {
    process.stderr.write(`[ERROR] ${args.join(' ')}\n`);
  },
  debug: (...args: any[]) => {
    if (process.env.DEBUG) {
      process.stderr.write(`[DEBUG] ${args.join(' ')}\n`);
    }
  }
}; 
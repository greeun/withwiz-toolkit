export function configWarn(module: string, message: string): void {
  try {
    console.warn(`[${module}] ${message}`);
  } catch {
    console.warn(`[${module}] ${message}`);
  }
}

export class ConfigurationError extends Error {
  constructor(module: string, message: string) {
    super(`[${module}] ${message}`);
    this.name = 'ConfigurationError';
  }
}

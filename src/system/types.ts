/**
 * types
 *
 * types
 * - System
 */
export interface ISystemInfo {
  nodeVersion: string;
  osInfo: string; // OS, Version, Architecture를 통합한 정보
  uptime: string;
  cpu: {
    system: number;
    processUsage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percent: number;
    processUsed: number;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    percent: number;
  };
  network: {
    rxRate: string;
    txRate: string;
    processRxRate: string;
    processTxRate: string;
    connections: number;
    processConnections: number;
  };
  environment: {
    key: string;
    ok: boolean;
    value?: string;
  }[];
  services: {
    name: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
    metrics: { label: string; value: string }[];
  }[];
}

export interface ICpuInfo {
  system: number;
  processUsage: number;
  cores: number;
  loadAverage: number[];
}

export interface IMemoryInfo {
  total: number;
  free: number;
  used: number;
  percent: number;
  processUsed: number;
}

export interface IDiskInfo {
  total: string;
  used: string;
  available: string;
  percent: number;
}

export interface INetworkInfo {
  rxRate: string;
  txRate: string;
  processRxRate: string;
  processTxRate: string;
  connections: number;
  processConnections: number;
}

export interface IEnvironmentInfo {
  key: string;
  ok: boolean;
  value?: string;
}

export interface IServiceInfo {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  metrics: { label: string; value: string }[];
} 
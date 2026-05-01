// QR 코드 관련 타입 정의
// src/shared/types/qr-code.ts

export interface IQRCodeSettings {
  size: number;
  color: string;
  bgColor: string;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  includeMargin: boolean;
  marginSize: number;
  logoUrl?: string;
  brandColor?: string;
}

export interface IQRCodeConfig {
  id: string;
  entityId: string;
  settings: IQRCodeSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQRTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  settings: IQRCodeSettings;
  isDefault: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQRCodeStats {
  totalInteractions: number;
  scanCount: number;
  directInteractions: number;
  interactions: number;
  apiInteractions: number;
  usageRate: number; // QR 사용률 (%)
}

export interface IQRCodeAnalytics {
  dailyStats: Array<{
    date: string;
    totalInteractions: number;
    scanCount: number;
    usageRate: number;
  }>;
  deviceStats: Array<{
    deviceType: string;
    totalInteractions: number;
    scanCount: number;
    usageRate: number;
  }>;
  browserStats: Array<{
    browser: string;
    totalInteractions: number;
    scanCount: number;
    usageRate: number;
  }>;
}

export interface IQRCodeDownloadOptions {
  format: 'png' | 'svg';
  filename: string;
  quality?: number;
}

// 기본 QR 설정
export const DEFAULT_QR_SETTINGS: IQRCodeSettings = {
  size: 300,
  color: '#000000',
  bgColor: '#FFFFFF',
  errorCorrectionLevel: 'M',
  includeMargin: true,
  marginSize: 4,
};

// QR 코드 템플릿 정의
export const QR_CODE_TEMPLATES = [
  {
    id: 'default',
    name: '기본',
    description: '표준 QR 코드 스타일',
    settings: DEFAULT_QR_SETTINGS
  },
  {
    id: 'minimal',
    name: '미니멀',
    description: '깔끔한 미니멀 스타일',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      color: '#333333',
      bgColor: '#FFFFFF',
      marginSize: 2
    }
  },
  {
    id: 'branded',
    name: '브랜드',
    description: '브랜드 컬러 적용',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      color: '#4A90D9',
      bgColor: '#F5F5F5',
      errorCorrectionLevel: 'H'
    }
  },
  {
    id: 'dark',
    name: '다크',
    description: '다크 테마 스타일',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      color: '#FFFFFF',
      bgColor: '#1F2937',
      errorCorrectionLevel: 'Q'
    }
  },
  {
    id: 'colorful',
    name: '컬러풀',
    description: '화려한 컬러 스타일',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      color: '#D94A4A',
      bgColor: '#FFF8E1',
      errorCorrectionLevel: 'H'
    }
  },
  {
    id: 'large',
    name: '라지',
    description: '큰 크기 QR 코드',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      size: 500,
      errorCorrectionLevel: 'H'
    }
  }
] as const;

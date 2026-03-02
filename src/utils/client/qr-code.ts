// QR 코드 관련 유틸리티 함수들
// /shared/ 내부에서 독립적으로 사용

import type { IQRCodeSettings, IQRCodeDownloadOptions } from '@withwiz/types/qr-code';

// QR 코드 설정 기본값 (스캔 성능 향상을 위해 개선)
export const DEFAULT_QR_SETTINGS: IQRCodeSettings = {
  size: 300, // 크기 증가
  color: '#000000',
  bgColor: '#FFFFFF',
  errorCorrectionLevel: 'H', // 높은 오류 수정 레벨 (로고 삽입 시 필요)
  includeMargin: true,
  marginSize: 4, // 여백 증가
};

// 사용자 브랜드 설정을 QR 코드 설정에 적용하는 함수
export const applyUserBrandToQRSettings = (
  settings: IQRCodeSettings,
  userBrand?: {
    brandColor?: string;
    brandLogoUrl?: string;
  }
): IQRCodeSettings => {
  if (!userBrand) return settings;

  return {
    ...settings,
    color: userBrand.brandColor || settings.color,
    logoUrl: userBrand.brandLogoUrl || settings.logoUrl,
  };
};

// QR 코드 템플릿들
export const QR_CODE_TEMPLATES: Array<{
  id: string;
  name: string;
  settings: IQRCodeSettings;
}> = [
  {
    id: 'default',
    name: '기본',
    settings: DEFAULT_QR_SETTINGS,
  },
  {
    id: 'dark',
    name: '다크 테마',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      color: '#FFFFFF',
      bgColor: '#1F2937',
    },
  },
  {
    id: 'blue',
    name: '블루 테마',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      color: '#2563EB',
      bgColor: '#FFFFFF',
    },
  },
  {
    id: 'green',
    name: '그린 테마',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      color: '#059669',
      bgColor: '#FFFFFF',
    },
  },
  {
    id: 'small',
    name: '작은 크기',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      size: 200, // 최소 크기 증가
    },
  },
  {
    id: 'large',
    name: '큰 크기',
    settings: {
      ...DEFAULT_QR_SETTINGS,
      size: 512,
    },
  },
];

// QR 코드 다운로드 함수
export const downloadQRCode = async (
  svgElement: SVGElement,
  options: IQRCodeDownloadOptions
): Promise<void> => {
  const { format, filename = 'qrcode', quality = 1.0 } = options;

  if (format === 'svg') {
    // SVG 다운로드
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(svgUrl);
  } else {
    // PNG 다운로드
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        },
        'image/png',
        quality
      );
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }
};

// QR 코드 URL 생성 함수 (QR 추적 파라미터 포함)
export const generateQRCodeUrl = (shortCode: string, baseUrl: string): string => {
  return `${baseUrl}/${shortCode}?src=qr`;
};

// 로고가 포함된 QR 코드 다운로드 함수
export const downloadQRCodeWithLogo = async (
  svgElement: SVGElement,
  logoDataUrl: string,
  options: IQRCodeDownloadOptions
): Promise<void> => {
  const { format, filename = 'qrcode', quality = 1.0 } = options;

  if (format === 'svg') {
    // SVG에 로고 추가 (로고 크기를 더 작게 조정)
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // 로고 이미지 요소 생성 (크기를 30%로 조정)
    const logoImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    logoImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', logoDataUrl);
    logoImage.setAttribute('x', '50%');
    logoImage.setAttribute('y', '50%');
    logoImage.setAttribute('width', '30%');
    logoImage.setAttribute('height', '30%');
    logoImage.setAttribute('transform', 'translate(-50%, -50%)');
    
    logoGroup.appendChild(logoImage);
    svgClone.appendChild(logoGroup);

    // SVG 다운로드
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(svgUrl);
  } else {
    // PNG에 로고 합성 (고품질로 개선)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 고해상도 캔버스 생성 (2배 크기)
    const scale = 2;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // 고품질 렌더링 설정
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // QR 코드를 2배 크기로 그리기
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // 로고 이미지 로드 및 합성 (크기를 30%로 조정)
      const logoImg = new Image();
      logoImg.onload = () => {
        const logoSize = Math.min(canvas.width, canvas.height) * 0.3;
        const logoX = (canvas.width - logoSize) / 2;
        const logoY = (canvas.height - logoSize) / 2;
        
        // 로고 배경에 흰색 원 추가 (스캔 성능 향상)
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${filename}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }
          },
          'image/png',
          1.0 // 최고 품질
        );
      };
      
      logoImg.src = logoDataUrl;
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }
};

// 로컬 스토리지에서 QR 코드 설정 불러오기
export const loadQRSettings = (): IQRCodeSettings => {
  if (typeof window === 'undefined') return DEFAULT_QR_SETTINGS;
  
  try {
    const saved = localStorage.getItem('qr-code-settings');
    return saved ? { ...DEFAULT_QR_SETTINGS, ...JSON.parse(saved) } : DEFAULT_QR_SETTINGS;
  } catch {
    return DEFAULT_QR_SETTINGS;
  }
};

// 로컬 스토리지에 QR 코드 설정 저장
export const saveQRSettings = (settings: IQRCodeSettings): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('qr-code-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save QR code settings:', error);
  }
};

/**
 * WorldMapChart
 *
 * WorldMapChart Component
 * - shadcn/ui 기반 UI 컴포넌트
 * - 모바일 반응형 지원 (핀치 줌, 드래그 스크롤)
 */
'use client';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

// @nivo/geo는 서버 사이드에서 next/document를 참조할 수 있으므로 dynamic import로 로드
const ResponsiveChoropleth = dynamic(
  () => import('@nivo/geo').then((mod) => mod.ResponsiveChoropleth),
  { ssr: false }
);

interface IWorldMapChartProps {
  data?: { id: string; value: number }[];
  geoJsonData?: any[]; // 외부에서 GeoJSON 데이터를 주입받음
  height?: number;
  colors?: string;
  unknownColor?: string;
  borderWidth?: number;
  borderColor?: string;
  valueFormat?: string; // 툴팁 수치 표시 형식
  enableMobileInteraction?: boolean; // 모바일 인터랙션 활성화
}

export default function WorldMapChart({
  data,
  geoJsonData,
  height = 320,
  colors = "nivo",
  unknownColor = "#eee",
  borderWidth = 0.5,
  borderColor = "#999",
  valueFormat = ",.0f", // 기본값: 천 단위 콤마, 소수점 없음 (예: 1,234)
  enableMobileInteraction = true
}: IWorldMapChartProps) {
  // GeoJSON을 클라이언트에서만 동적으로 import (기본값)
  const [features, setFeatures] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 터치 거리 계산
  const getTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // 터치 시작
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableMobileInteraction) return;

    if (e.touches.length === 2) {
      // 핀치 줌 시작
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1) {
      // 드래그 시작
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  }, [enableMobileInteraction, getTouchDistance, position]);

  // 터치 이동
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enableMobileInteraction) return;

    if (e.touches.length === 2 && lastTouchDistance !== null) {
      // 핀치 줌
      e.preventDefault();
      const newDistance = getTouchDistance(e.touches);
      if (newDistance !== null) {
        const scaleChange = newDistance / lastTouchDistance;
        setScale(prev => Math.max(0.5, Math.min(3, prev * scaleChange)));
        setLastTouchDistance(newDistance);
      }
    } else if (e.touches.length === 1 && isDragging) {
      // 드래그
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
    }
  }, [enableMobileInteraction, lastTouchDistance, getTouchDistance, isDragging, dragStart]);

  // 터치 종료
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setLastTouchDistance(null);
  }, []);

  // 리셋 버튼
  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);
  
  useEffect(() => {
    const processFeatures = (rawFeatures: any[]) => {
      if (!Array.isArray(rawFeatures)) return [];
      
      const idMap = new Map<string, number>();
      const processedFeatures: any[] = [];
      
      rawFeatures.forEach((f, index) => {
        const isoCode = f.properties?.['ISO3166-1-Alpha-2'] || f.isoCode;
        const countryName = f.properties?.name || f.countryName;
        
        // isoCode를 대문자로 정규화 (null/undefined 처리)
        let normalizedIsoCode = isoCode ? String(isoCode).trim().toUpperCase() : null;
        
        // 잘못된 값 필터링 (-99, 빈 문자열 등)
        if (normalizedIsoCode === '-99' || normalizedIsoCode === '' || normalizedIsoCode === 'NULL') {
          normalizedIsoCode = null;
        }
        
        // ResponsiveChoropleth는 feature의 id와 data의 id를 매칭하므로
        // isoCode를 id로 설정 (null인 경우 고유 ID 사용)
        let featureId: string;
        if (normalizedIsoCode) {
          featureId = normalizedIsoCode;
        } else {
          // 고유한 feature ID 생성
          const baseId = `feature-${index}`;
          const count = idMap.get(baseId) || 0;
          idMap.set(baseId, count + 1);
          featureId = count > 0 ? `${baseId}-${count}` : baseId;
        }
        
        // 중복된 id가 이미 존재하는지 확인
        const existingIndex = processedFeatures.findIndex(f => f.id === featureId);
        if (existingIndex === -1) {
          processedFeatures.push({
            ...f,
            id: featureId,
            isoCode: normalizedIsoCode,
            countryName: countryName
          });
        }
      });
      
      return processedFeatures;
    };
    
    if (geoJsonData) {
      // 외부에서 제공된 GeoJSON 데이터 사용
      const normalizedGeoJsonData = processFeatures(geoJsonData);
      setFeatures(normalizedGeoJsonData);
    } else {
      // 기본 GeoJSON 데이터 로드 (동적 import)
      import('./world_countries.json').then((mod) => {
        // Handle both possible import shapes
        const features = (mod as { features?: any[]; default?: { features?: any[] } }).features || (mod as { default?: { features?: any[] } }).default?.features || [];
        const featuresWithId = processFeatures(features);
        setFeatures(featuresWithId);
      });
    }
  }, [geoJsonData]);
  
  // 데이터 전처리: null, undefined, 빈 문자열 필터링 및 고유 키 생성
  const processedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    
    // 유효한 데이터만 필터링 (null, undefined, 빈 문자열, '-99' 제외)
    const validData = data.filter(item => 
      item && 
      item.id && 
      item.id.trim() !== '' && 
      item.id !== '-99' &&
      typeof item.value === 'number' && 
      item.value > 0
    );
    
    // 중복 제거 및 집계
    const dataMap = new Map<string, number>();
    validData.forEach(item => {
      const key = item.id.trim().toUpperCase();
      const existingValue = dataMap.get(key) || 0;
      dataMap.set(key, existingValue + item.value);
    });
    
    // Map을 배열로 변환
    const result = Array.from(dataMap.entries()).map(([countryCode, value]) => ({
      id: countryCode,
      value
    }));
    
    
    return result;
  }, [data]);
  
  // 모바일에서 더 큰 projectionScale 사용
  const projectionScale = isMobile ? 80 : 100;

  // 모바일에서 레전드 위치 조정
  const legendConfig = isMobile ? {
    anchor: 'bottom-left' as const,
    direction: 'row' as const,
    justify: false,
    translateX: 0,
    translateY: -10,
    itemsSpacing: 2,
    itemWidth: 60,
    itemHeight: 14,
    itemDirection: 'left-to-right' as const,
    itemTextColor: '#444',
    itemOpacity: 0.85,
    symbolSize: 12
  } : {
    anchor: 'bottom-left' as const,
    direction: 'column' as const,
    justify: true,
    translateX: 20,
    translateY: -60,
    itemsSpacing: 0,
    itemWidth: 94,
    itemHeight: 18,
    itemDirection: 'left-to-right' as const,
    itemTextColor: '#444',
    itemOpacity: 0.85,
    symbolSize: 18
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden touch-pan-x touch-pan-y w-full h-full"
      style={height !== undefined ? { height } : undefined}
    >
      {/* 모바일 컨트롤 버튼 */}
      {isMobile && enableMobileInteraction && (scale !== 1 || position.x !== 0 || position.y !== 0) && (
        <button
          onClick={handleReset}
          className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-1.5 shadow-sm transition-colors"
          aria-label="지도 초기화"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      )}

      {/* 모바일 힌트 */}
      {isMobile && enableMobileInteraction && scale === 1 && position.x === 0 && position.y === 0 && (
        <div className="absolute bottom-1 right-2 z-10 text-[10px] text-muted-foreground/70 pointer-events-none">
          드래그/핀치 줌 가능
        </div>
      )}

      {features.length > 0 ? (
        <div
          className="w-full h-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <ResponsiveChoropleth
            key={`world-map-${processedData.length}-${Date.now()}`}
            data={processedData}
            features={features}
            margin={{ top: 0, right: 0, bottom: isMobile ? 30 : 0, left: 0 }}
            colors={colors}
            domain={[0, Math.max(1, ...processedData.map(d => d.value))]}
            unknownColor={unknownColor}
            label="properties.name"
            valueFormat={valueFormat}
            projectionScale={projectionScale}
            projectionTranslation={[0.5, isMobile ? 0.55 : 0.5]}
            projectionRotation={[0, 0, 0]}
            borderWidth={borderWidth}
            borderColor={borderColor}
            legends={[legendConfig]}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          지도 데이터 로딩 중...
        </div>
      )}
    </div>
  );
}

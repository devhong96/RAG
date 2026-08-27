import sharp from "sharp"

/**
 * 실습용 고해상도(300 DPI) 스캔 문서 이미지 생성 유틸리티.
 */
export async function generateSampleDocImage(outputPath = "./sample-doc-scan.png"): Promise<string> {
  const svg = `
<svg width="1000" height="700" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff"/>
  
  <text x="50" y="60" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="26" font-weight="bold" fill="#111827">
    [사내 기술 표준 규격서] 2026년 차세대 AI 인프라 서버 및 냉각 가이드라인
  </text>
  
  <line x1="50" y1="85" x2="950" y2="85" stroke="#9ca3af" stroke-width="2"/>
  
  <text x="50" y="130" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="18" font-weight="bold" fill="#1f2937">
    1. 하드웨어 필수 사양 목록
  </text>
  
  <text x="70" y="170" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="16" fill="#374151">
    - GPU 모델: NVIDIA H100 SXM5 80GB x 8장 탑재 (총 640GB VRAM)
  </text>
  <text x="70" y="210" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="16" fill="#374151">
    - 호스트 메모리: 2TB DDR5 ECC Registered (4800MHz, 대규모 KV 캐시용)
  </text>
  <text x="70" y="250" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="16" fill="#374151">
    - 네트워크: 400Gbps InfiniBand Quantum-2 (노드 간 초고속 AllReduce용)
  </text>
  <text x="70" y="290" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="16" fill="#374151">
    - 로컬 스토리지: NVMe U.2 30TB PCIe 5.0 (벡터 임베딩 인덱스 전용 캐시)
  </text>
  <text x="70" y="330" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="16" fill="#374151">
    - 냉각 솔루션: 다이렉트 칩 액체 냉각 (Direct Liquid Cooling, DLC 방식 필수)
  </text>

  <line x1="50" y1="370" x2="950" y2="370" stroke="#e5e7eb" stroke-width="1.5"/>

  <text x="50" y="420" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="18" font-weight="bold" fill="#b91c1c">
    2. 데이터센터 반입 및 규정 준수 사항 (필독)
  </text>
  
  <text x="70" y="460" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="15" fill="#1f2937">
    (1) 2026년 3분기 이후 신규 데이터센터에 입고되는 모든 인공지능 서버는 공랭식 사용이 전면 금지된다.
  </text>
  <text x="70" y="500" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="15" fill="#1f2937">
    (2) 랙당 40kW 이상의 고밀도 발열을 해소하기 위해 반드시 DLC 공인 인증을 획득한 벤더 장비만 설치 가능하다.
  </text>
  <text x="70" y="540" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="15" fill="#1f2937">
    (3) 인증 미획득 장비는 전산실 전력 인가가 즉시 차단되며 반입이 거부된다.
  </text>

  <rect x="50" y="590" width="900" height="60" fill="#f3f4f6" rx="6"/>
  <text x="70" y="626" font-family="Apple SD Gothic Neo, Arial, sans-serif" font-size="14" fill="#4b5563">
    * 담당 부서: AI 인프라 플랫폼팀 (내선: 8840) | 문서 등급: 사내 대외비 (Level 2)
  </text>
</svg>
`
  await sharp(Buffer.from(svg), { density: 300 })
    .png()
    .toFile(outputPath)

  return outputPath
}

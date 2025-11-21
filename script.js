// ---------------------------------------------------------
// 1. DATASET & INITIALIZATION
// ---------------------------------------------------------
let regionData = [];
let map;
let markersLayer; // 마커들을 관리할 레이어 그룹
let typeInterval; // 타이핑 효과용 변수 (전역 선언)
let currentRegionStats = null; // 현재 선택된 지역의 통계 데이터 (시뮬레이터용)
let scatterChart = null; // 산점도 차트 객체
let selectedRegionName = null; // 현재 선택된 지역 이름 (필터링 시 유지용)
let currentFilterType = 'all'; // 현재 적용된 필터 타입
let currentStoreSize = 40; // 기본값 40평

// 초기 실행
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadData();
    loadPersonaData(); 
    initNavigation(); // 네비게이션 초기화
    initSimulator(); // 시뮬레이터 초기화
});

// ---------------------------------------------------------
// 0. NAVIGATION & SIMULATOR
// ---------------------------------------------------------
function initNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            // 1. Active 클래스 업데이트
            menuItems.forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            
            // 2. 스크롤 이동
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }
            }
        });
    });
}

function initSimulator() {
    const slider = document.getElementById('captureRateSlider');
    const display = document.getElementById('captureRateDisplay');
    const rateText = document.getElementById('revRate');
    
    // 매장 규모 버튼 이벤트
    const sizeBtns = document.querySelectorAll('.size-btn');
    const sizeDisplay = document.getElementById('storeSizeDisplay');

    sizeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 스타일 업데이트
            sizeBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // 값 업데이트
            currentStoreSize = parseInt(e.target.getAttribute('data-size'));
            sizeDisplay.innerText = currentStoreSize + "평";

            // 매출 재계산
            if (currentRegionStats) {
                const currentRate = parseFloat(slider.value);
                calculateRevenue(currentRate);
            }
        });
    });
    
    // 로직 설명 박스 토글
    const infoBtn = document.getElementById('logicInfoBtn');
    const infoBox = document.getElementById('logicInfoBox');
    
    if (infoBtn && infoBox) {
        infoBtn.addEventListener('click', () => {
            if (infoBox.style.display === 'none' || infoBox.style.display === '') {
                infoBox.style.display = 'block';
            } else {
                infoBox.style.display = 'none';
            }
        });
    }

    slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const percentage = val.toFixed(2) + "%";
        
        display.innerText = percentage;
        rateText.innerText = percentage;
        
        // 실시간 매출 재계산
        if (currentRegionStats) {
            calculateRevenue(val);
        }
    });
}

function calculateRevenue(rate) {
    if (!currentRegionStats) return;

    // rate는 % 단위 (예: 0.01 -> 0.01%)
    const realRate = rate / 100; 

    // 1. 내 가게 방문객 (Headcount)
    // 기존 로직 유지 (사용자가 103명을 원함 -> / 30 적용)
    // *주의: 원본 데이터가 연간 데이터라도, 사용자가 원하는 수치 스케일에 맞춰 / 30으로 계산
    const baseVisitors = currentRegionStats.visitor * realRate;
    const dailyVisitors = Math.round(baseVisitors / 30);

    // 2. 테이블 수 환산 (Group Size Factor 2.4)
    // 방문객 수 / 2.4 = 예상 테이블 수
    const dailyTables = dailyVisitors / 2.4;

    // 3. 월 예상 매출 계산
    // 일일 테이블 수 * 30일 * 객단가
    const monthlyRevenue = Math.round(dailyTables * 30 * currentRegionStats.spend);

    document.getElementById('revenueVal').innerText = monthlyRevenue.toLocaleString() + " 원";
    document.getElementById('dailyVisitorVal').innerText = dailyVisitors.toLocaleString();
    
    // 4. 평당 매출 효율 진단
    const efficiencyBox = document.getElementById('efficiencyBox');
    const effScoreEl = document.getElementById('effScore');
    const effMessageEl = document.getElementById('effMessage');
    
    if (efficiencyBox) {
        efficiencyBox.style.display = 'block';
        
        // 평당 매출 (만원 단위)
        const revenuePerPyeong = Math.round((monthlyRevenue / currentStoreSize) / 10000); 
        effScoreEl.innerText = revenuePerPyeong.toLocaleString() + " 만원/평";

        // 진단 로직
        efficiencyBox.className = 'efficiency-box'; // 초기화
        if (revenuePerPyeong < 100) {
            efficiencyBox.classList.add('eff-bad');
            effMessageEl.innerHTML = `🚨 <b>공간 효율이 낮습니다.</b><br>고정비(월세) 부담이 클 수 있습니다.`;
        } else if (revenuePerPyeong < 150) {
            efficiencyBox.classList.add('eff-bad'); // Caution도 Bad 스타일 공유 혹은 별도 스타일
            effMessageEl.innerHTML = `⚠️ <b>다소 아쉽습니다.</b><br>회전율을 높이거나 객단가를 올려야 합니다.`;
        } else if (revenuePerPyeong <= 250) {
            efficiencyBox.classList.add('eff-normal');
            effMessageEl.innerHTML = `✅ <b>적정 수준입니다.</b><br>안정적인 운영이 예상됩니다.`;
        } else {
            efficiencyBox.classList.add('eff-good');
            effMessageEl.innerHTML = `🚀 <b>매우 훌륭합니다!</b><br>높은 공간 효율로 고수익이 기대됩니다.`;
        }
    }
    
    // 애니메이션 효과 (숫자가 바뀔 때 강조)
    const valEl = document.getElementById('revenueVal');
    const dailyEl = document.getElementById('dailyVisitorVal');
    
    valEl.style.color = "#e17055";
    dailyEl.style.color = "#e17055";
    
    setTimeout(() => { 
        valEl.style.color = ""; 
        dailyEl.style.color = "#e17055"; // 일일 방문객은 강조색 유지
    }, 300);
}

async function loadData() {
    try {
        const [supplyRes, masterRes] = await Promise.all([
            fetch('local_supply_demand.csv'),
            fetch('dim_region_master.csv')
        ]);

        const supplyText = await supplyRes.text();
        const masterBuffer = await masterRes.arrayBuffer();
        const masterText = new TextDecoder('euc-kr').decode(masterBuffer);

        const supplyRows = supplyText.split('\n').slice(1); // 헤더 제거
        const masterRows = masterText.split('\n').slice(1); // 헤더 제거

        // Master 데이터 파싱 (Lookup 최적화를 위해 배열로 변환)
        const masterList = masterRows.map(row => {
            const cols = row.split(',');
            if (cols.length < 6) return null;

            // 데이터 보정: '전라' -> '전남' (UI 표시용)
            let sidoAbbr = cols[4] ? cols[4].trim() : '';
            if (sidoAbbr === '전라') sidoAbbr = '전남';

            let naverRegion = cols[6] ? cols[6].trim() : '';
            const sigName = cols[5] ? cols[5].trim() : '';
            const sigun = cols[7] ? cols[7].trim() : '';

            // Supabase 매핑 로직 수정
            if (sidoAbbr === '세종') {
                naverRegion = '세종특별자치시';
            } else if (['서울', '부산', '대구', '인천', '광주', '대전', '울산'].includes(sidoAbbr)) {
                // 광역시/특별시: naver_region 사용 (예: 서울 용산구)
                // naverRegion이 비어있으면 조합해서라도 만듦
                if (!naverRegion) naverRegion = `${sidoAbbr} ${sigName}`;
            } else {
                // 도 단위: 시군구명(sigun)만 사용 (예: 의왕시, 춘천시, 수원시)
                // sigun이 있으면 사용, 없으면 sig_name 사용
                naverRegion = sigun || sigName;
            }

            return {
                lat: parseFloat(cols[1]),
                lng: parseFloat(cols[2]),
                sido_full: cols[3] ? cols[3].trim() : '',
                sido_abbr: sidoAbbr,
                sig_name: sigName,
                sigun: sigun, // 매칭용 시군명 추가
                naver_region: naverRegion // 네이버 트렌드 검색용 지역명
            };
        }).filter(item => item !== null);

        // 시도 약칭 매핑 (Abbr -> Full Name Part)
        // local_supply_demand.csv의 풀네임과 매칭하기 위함
        const sidoMapping = {
            '충북': '충청북도',
            '충남': '충청남도',
            '경북': '경상북도',
            '경남': '경상남도',
            '전남': '전라남도',
            '전북': '전북특별자치도',
            '강원': '강원특별자치도',
            '제주': '제주특별자치도',
            '세종': '세종특별자치시'
        };

        // Supply 데이터와 Master 데이터 조인
        regionData = supplyRows.map(row => {
            const cols = row.split(',');
            if (cols.length < 4) return null;

            let regionName = cols[0].trim(); // 예: 강원특별자치도 춘천시
            
            // 데이터 보정: 세종 중복 표기 수정 (UI 깔끔하게)
            if (regionName === '세종특별자치시 세종특별자치시') {
                regionName = '세종특별자치시';
            }

            const visitor = parseInt(cols[1]);
            const restaurant = parseInt(cols[2]);
            const quadrant = cols[3].trim(); // 경쟁포화지역, 기회지역, 저관심지역, 공급과잉

            // 좌표 매칭 로직
            // 1. 시군구명(마지막 단어) 추출
            const parts = regionName.split(' ');
            const sigName = parts[parts.length - 1]; // 춘천시
            
            // 2. Master에서 시군구명이 일치하고, 시도명이 포함되는지 확인
            const matched = masterList.find(m => {
                // 매핑된 풀네임이 있으면 그것을 사용, 없으면 약칭 그대로 사용
                const targetSido = sidoMapping[m.sido_abbr] || m.sido_abbr;
                // 시군구명(sig_name)이 일치하거나, 시군명(sigun)이 일치하는 경우 (예: 수원시 장안구 -> 수원시)
                const nameMatch = (m.sig_name === sigName) || (m.sigun === sigName);
                return nameMatch && regionName.includes(targetSido);
            });

            if (matched) {
                return {
                    name: regionName,
                    lat: matched.lat,
                    lng: matched.lng,
                    visitor: visitor,
                    restaurant: restaurant,
                    quadrant: quadrant, // 원본 사분면 데이터 저장
                    sido: matched.sido_abbr, // 페르소나 매핑용
                    naver_region: matched.naver_region // 네이버 트렌드 매핑용
                };
            }
            return null;
        }).filter(item => item !== null);

        console.log(`Loaded ${regionData.length} regions.`);
        
        initDropdowns();
        renderMarkers();
        initScatterChart(); // 산점도 초기화

    } catch (err) {
        console.error("Data Load Error:", err);
    }
}

// ---------------------------------------------------------
// 2. MAP & MARKERS
// ---------------------------------------------------------
function initMap() {
    // 37.6, 128.0 중심 (강원도/경기 동부 쪽 포커스) -> 전국으로 변경
    map = L.map('map').setView([36.5, 127.8], 7); 

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
    
    markersLayer = L.layerGroup().addTo(map);

    // 필터 버튼 이벤트 연결
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 활성화 스타일 변경
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // 필터링 실행
            const filterType = e.target.getAttribute('data-filter');
            renderMarkers(filterType);
        });
    });
}

function renderMarkers(filterType) {
    // 필터 타입이 전달되면 업데이트, 아니면 기존 값 유지
    if (filterType) currentFilterType = filterType;
    
    markersLayer.clearLayers();

    regionData.forEach(region => {
        const isSelected = region.name === selectedRegionName;

        // 필터링 로직: 선택된 지역은 필터 무시하고 항상 표시
        if (!isSelected && currentFilterType !== 'all' && region.quadrant !== currentFilterType) {
            return; // 조건에 맞지 않으면 건너뜀
        }

        const customIcon = getMarkerIcon(region, isSelected);

        const marker = L.marker([region.lat, region.lng], { icon: customIcon });
        marker.regionName = region.name; // 마커에 지역명 저장 (하이라이트용)

        // 선택된 마커는 z-index를 높여서 맨 위에 표시
        if (isSelected) {
            marker.setZIndexOffset(1000);
        }

        marker.bindTooltip(
            `<div class="tooltip-custom">
                <div>${region.name}</div>
                <div style="font-size:0.8rem; color:#636e72;">${region.quadrant}</div>
            </div>`,
            { permanent: false, direction: 'top' }
        );

        marker.on('click', () => {
            updateDashboard(region);
            map.flyTo([region.lat, region.lng], 11, { duration: 1.5 });
        });
        
        markersLayer.addLayer(marker);
    });
}

function getMarkerIcon(region, isSelected = false) {
    let markerColor;
    let pulseClass = "";

    // 사분면에 따른 마커 색상 및 효과 설정
    switch (region.quadrant) {
        case '기회지역':
            markerColor = "#F37021"; // 오렌지 (블루스팟)
            pulseClass = "pulse-icon";
            break;
        case '경쟁포화지역':
            markerColor = "#d63031"; // 레드 (레드오션)
            break;
        case '저관심지역':
            markerColor = "#636e72"; // 그레이
            break;
        case '공급과잉':
            markerColor = "#0984e3"; // 블루 (공급과잉 - 예시 색상)
            break;
        default:
            markerColor = "#636e72";
    }

    let iconHtml;
    let size = isSelected ? 24 : 12; // 선택되면 크기 2배
    let anchor = isSelected ? [12, 12] : [6, 6];

    if (isSelected) {
        // 선택된 마커 스타일 (강조)
        iconHtml = `<div style="
            background-color:${markerColor}; 
            width:${size}px; height:${size}px; 
            border-radius:50%; 
            border: 3px solid white; 
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            animation: bounce 1s infinite;"></div>`;
    } else {
        // 일반 마커 스타일
        iconHtml = region.quadrant === "기회지역" 
            ? `<div class="${pulseClass}" style="background-color:${markerColor}; width:${size}px; height:${size}px; border-radius:50%;"></div>`
            : `<div style="background-color:${markerColor}; width:${size - 2}px; height:${size - 2}px; border-radius:50%; border:1px solid white;"></div>`;
    }

    return L.divIcon({
        className: 'custom-marker',
        html: iconHtml,
        iconSize: [size, size],
        iconAnchor: anchor
    });
}

function highlightMarker(regionName) {
    markersLayer.eachLayer(layer => {
        if (layer.regionName === regionName) {
            const region = regionData.find(r => r.name === regionName);
            if (region) {
                layer.setIcon(getMarkerIcon(region, true));
                layer.setZIndexOffset(1000); // 맨 위로 올리기
            }
        } else {
            // 다른 마커들은 원래대로 복구 (혹은 이미 원래 상태라면 유지)
            // 성능을 위해 현재 아이콘 상태를 체크할 수도 있지만, 간단하게 다시 설정
            const region = regionData.find(r => r.name === layer.regionName);
            if (region) {
                layer.setIcon(getMarkerIcon(region, false));
                layer.setZIndexOffset(0);
            }
        }
    });
}

// ---------------------------------------------------------
// 3. DROPDOWN & SEARCH
// ---------------------------------------------------------
function initDropdowns() {
    const sidoSelect = document.getElementById('sidoSelect');
    const sigunguSelect = document.getElementById('sigunguSelect');
    const searchBtn = document.getElementById('searchBtn');

    // 시도 목록 추출 (중복 제거)
    const sidos = [...new Set(regionData.map(r => r.sido))].sort();
    
    sidos.forEach(sido => {
        const option = document.createElement('option');
        option.value = sido;
        option.textContent = sido;
        sidoSelect.appendChild(option);
    });

    // 시도 변경 시 시군구 목록 업데이트
    sidoSelect.addEventListener('change', () => {
        const selectedSido = sidoSelect.value;
        sigunguSelect.innerHTML = '<option value="">시/군/구 선택</option>';
        
        if (!selectedSido) return;

        const sigungus = regionData
            .filter(r => r.sido === selectedSido)
            .map(r => r.name) // 전체 이름 사용 (예: 강원특별자치도 춘천시)
            .sort();

        sigungus.forEach(fullName => {
            const option = document.createElement('option');
            option.value = fullName;
            // 드롭다운에는 시군구명만 표시 (예: 춘천시)
            option.textContent = fullName.split(' ').pop(); 
            sigunguSelect.appendChild(option);
        });
    });

    // 이동 버튼 클릭
    searchBtn.addEventListener('click', () => {
        const selectedRegionName = sigunguSelect.value;
        if (!selectedRegionName) {
            alert("지역을 선택해주세요.");
            return;
        }

        const target = regionData.find(r => r.name === selectedRegionName);
        if (target) {
            updateDashboard(target);
            map.flyTo([target.lat, target.lng], 11, { duration: 1.5 });
        }
    });
}

// ---------------------------------------------------------
// 4. PERSONA DATA (From PDF: persona_top.csv)
// ---------------------------------------------------------
let personaData = {};

async function loadPersonaData() {
    try {
        const response = await fetch('persona_top.csv');
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('utf-8'); // UTF-8로 변경
        const text = decoder.decode(buffer);
        
        const rows = text.split('\n');
        
        // CSV 구조: 지역, 연령, 성별, 소비금액합계, 결제건수합계, 평균결제금액
        // 예: 강원,40,M,1.91682E+12,65861083,29103.99606
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            
            const cols = row.split(',');
            if (cols.length >= 6) {
                const region = cols[0].trim(); // 시도명 (예: 강원)
                const age = cols[1].trim();
                const genderCode = cols[2].trim();
                const avgSpendVal = parseFloat(cols[5]);
                
                const gender = genderCode === 'M' ? '남성' : '여성';
                const spend = Math.round(avgSpendVal).toLocaleString() + '원';
                
                personaData[region] = {
                    age: age + '대',
                    gender: gender,
                    spend: spend,
                    rawSpend: avgSpendVal, // 계산용 원본 데이터 저장
                    desc: `${region} 지역은 ${age}대 ${gender}의 평균 결제 금액이 ${spend}으로 가장 높습니다.`
                };
            }
        }
        console.log("Persona Data Loaded:", personaData);
    } catch (e) {
        console.error("CSV Load Error:", e);
    }
}

// 데이터 로드 실행 (DOMContentLoaded에서 호출됨)
// loadPersonaData(); 

// ---------------------------------------------------------
// 4. DASHBOARD LOGIC
// ---------------------------------------------------------
function updateDashboard(region) {
    // A. 페르소나 카드 업데이트
    // 데이터가 로드되었는지 확인
    const p = personaData[region.sido]; 
    
    document.getElementById('personaRegionTag').innerText = region.name;
    
    if (p) {
        document.getElementById('personaContent').innerHTML = `
            <div class="stat-row">
                <span>핵심 소비자</span>
                <span class="stat-value" style="color:var(--secondary-color)">${p.age} ${p.gender}</span>
            </div>
            <div class="stat-row">
                <span>평균 객단가</span>
                <span class="stat-value" style="color:var(--primary-color)">${p.spend}</span>
            </div>
            <div style="margin-top:10px; font-size:0.9rem; color:#636e72; line-height:1.4;">
                💬 <b>특징:</b> ${p.desc}
            </div>
        `;
    } else {
        document.getElementById('personaContent').innerHTML = `
            <div style="padding:20px; text-align:center; color:#999;">
                데이터를 불러오는 중이거나<br>해당 지역(${region.sido})의 데이터가 없습니다.
            </div>
        `;
    }

    // B. 포지션 카드 업데이트
    const badgeEl = document.getElementById('quadrantBadge');
    const strategyEl = document.getElementById('strategyText');

    document.getElementById('demandVal').innerText = (region.visitor / 10000).toLocaleString() + "만 명";
    document.getElementById('supplyVal').innerText = region.restaurant.toLocaleString() + "개";

    // 선택된 지역 상태 업데이트 (필터링 시 유지용)
    selectedRegionName = region.name;

    // 산점도 하이라이트 업데이트
    updateScatterHighlight(region);

    // 지도 마커 하이라이트 업데이트 (renderMarkers를 호출하여 상태 반영)
    // highlightMarker 함수 대신 renderMarkers를 호출하여 전체 상태를 갱신 (필터 유지 + 선택 강조)
    renderMarkers(); 

    // AI Text 및 전략 텍스트 구성을 위한 기본값 설정
    const targetAudience = p ? `${p.age} ${p.gender}` : "핵심 고객";

    // 사분면별 배지 및 전략 텍스트 설정
    if (region.quadrant === "기회지역") {
        badgeEl.className = "quadrant-badge badge-opportunity";
        badgeEl.innerHTML = `<i class="fa-solid fa-bolt"></i> 블루스팟 (기회)`;
        strategyEl.innerHTML = `💡 <b>전략:</b> ${region.name}은 관광객 유입 대비 식당 공급이 부족합니다. <br>경쟁이 적은 지금, 차별화된 컨셉으로 <b>시장 선점</b>이 가능합니다.`;
    } else if (region.quadrant === "경쟁포화지역") {
        badgeEl.className = "quadrant-badge badge-saturated";
        badgeEl.innerHTML = `<i class="fa-solid fa-fire"></i> 레드오션 (포화)`;
        strategyEl.innerHTML = `🚨 <b>주의:</b> ${region.name}은 이미 다수의 맛집이 경쟁 중입니다. <br>단순 진입보다는 <b>${targetAudience}</b> 타겟의 니치 마켓(웨이팅 분산 등)을 공략하세요.`;
    } else if (region.quadrant === "저관심지역") {
        badgeEl.className = "quadrant-badge badge-low";
        badgeEl.innerHTML = `<i class="fa-solid fa-moon"></i> 저관심지역`;
        strategyEl.innerHTML = `💤 <b>분석:</b> ${region.name}은 아직 유동인구와 상권 활성도가 낮습니다. <br>무리한 진입보다는 <b>장기적인 상권 발달 추이</b>를 지켜보는 것이 좋습니다.`;
    } else if (region.quadrant === "공급과잉") {
        badgeEl.className = "quadrant-badge badge-oversupply";
        badgeEl.innerHTML = `<i class="fa-solid fa-exclamation-triangle"></i> 공급과잉`;
        strategyEl.innerHTML = `⚠️ <b>경고:</b> ${region.name}은 수요 대비 식당 공급이 너무 많습니다. <br>폐업률이 높을 수 있으니 <b>철저한 경쟁사 분석</b> 없이는 진입을 피하세요.`;
    } else {
        // 기본값 (데이터 매칭 안될 경우)
        badgeEl.className = "quadrant-badge badge-low";
        badgeEl.innerHTML = `<i class="fa-solid fa-question"></i> 분석 대기`;
        strategyEl.innerHTML = `지도를 클릭하여 지역별 진입 전략을 확인하세요.`;
    }

    // C. AI Typing Effect
    let aiText = "";
    
    switch (region.quadrant) {
        case '경쟁포화지역': // 레드오션
            aiText = `데이터 분석 결과, 이 지역은 이미 성숙한 상권으로 진입 장벽이 높습니다. 단순한 메뉴 구성보다는 기존 맛집들이 충족시키지 못하는 '틈새 취향'이나 '강력한 비주얼 브랜딩'을 통해 웨이팅 수요를 뺏어오는 전략이 필수적입니다.`;
            break;
        case '기회지역': // 블루스팟
            aiText = `좋아요! 데이터가 가리키는 가장 확실한 기회 지역입니다. 풍부한 유동인구 대비 식당 공급이 현저히 부족해, 오픈 즉시 안정적인 매출 확보가 예상됩니다. 경쟁자가 늘어나기 전에 공격적으로 진입하여 지역 랜드마크로 자리 잡으세요.`;
            break;
        case '저관심지역': // 저관심
            aiText = `아직 외부인의 발길이 뜸한 잠재 상권입니다. 단순히 문을 열고 기다리는 영업보다는, SNS를 통해 멀리서도 찾아오게 만드는 '목적형 맛집(Destination Restaurant)' 전략이 유효합니다. 로컬 주민을 타겟으로 한 단골 확보 전략도 병행하세요.`;
            break;
        case '공급과잉': // 공급과잉
            aiText = `경고: 유동인구 대비 매장 수가 과도하게 많아 경쟁 피로도가 극에 달한 상태입니다. 현재 데이터로는 신규 진입을 권장하지 않습니다. 만약 진입해야 한다면, 경쟁사 폐업률을 면밀히 분석하고 압도적인 가성비 전략을 고려해야 합니다.`;
            break;
        default:
            aiText = `데이터 분석 완료. ${region.name}의 핵심 소비층은 ${targetAudience}입니다. 지역 특성에 맞는 차별화 전략을 수립하세요.`;
    }
    
    typeWriter(aiText, 'aiText');

    // D. 예상 매출 시뮬레이터 업데이트
    if (p && p.rawSpend) {
        // 현재 지역 데이터 저장 (슬라이더 조절용)
        currentRegionStats = {
            visitor: region.visitor,
            spend: p.rawSpend
        };

        // 슬라이더 값 초기화 (기본 0.01%)
        const slider = document.getElementById('captureRateSlider');
        slider.value = 0.01;
        document.getElementById('captureRateDisplay').innerText = "0.01%";
        document.getElementById('revRate').innerText = "0.01%";

        // 초기 계산
        calculateRevenue(0.01);
        
        document.getElementById('revVisitor').innerText = region.visitor.toLocaleString();
        document.getElementById('revSpend').innerText = Math.round(p.rawSpend).toLocaleString();
    } else {
        currentRegionStats = null;
        document.getElementById('revenueVal').innerText = "- 원";
        document.getElementById('dailyVisitorVal').innerText = "-";
        document.getElementById('revVisitor').innerText = "-";
        document.getElementById('revSpend').innerText = "-";
    }

    // E. 차트 업데이트 (Supabase 연동 시뮬레이션)
    updateChart(region);
}


// ---------------------------------------------------------
// 5. TREND CHART (Chart.js + Supabase Real)
// ---------------------------------------------------------
// Supabase Client Initialization
const SUPABASE_URL = 'https://oillqahutccvyesjpobr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbGxxYWh1dGNjdnllc2pwb2JyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzUxMDcxNiwiZXhwIjoyMDc5MDg2NzE2fQ.lIss5NFNyiyu62lmpblmEq8Nd_9FFKKVguzjPkRSWeg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let trendChart = null;

async function updateChart(regionOrName) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    let targetRegionName = "";
    let displayName = "";

    if (typeof regionOrName === 'string') {
        // "전국" 같은 문자열이 들어온 경우
        targetRegionName = regionOrName;
        displayName = regionOrName;
    } else if (regionOrName && typeof regionOrName === 'object') {
        // region 객체가 들어온 경우
        // naver_region이 있으면 우선 사용 (예: "서울 종로구")
        // 없으면 기존 로직대로 이름 파싱 (예: "춘천시")
        if (regionOrName.naver_region) {
            targetRegionName = regionOrName.naver_region;
        } else {
            targetRegionName = regionOrName.name.split(' ').pop();
        }
        displayName = regionOrName.name.split(' ').pop(); // 차트 라벨용은 짧은 이름
    }

    try {
        // Supabase 데이터 조회
        const { data, error } = await supabase
            .from('naver_local_trend')
            .select('date, search_index')
            .eq('region', targetRegionName)
            .order('date', { ascending: true });

        if (error) throw error;

        let labels = [];
        let dataPoints = [];

        if (data && data.length > 0) {
            // 데이터가 있으면 매핑
            labels = data.map(d => {
                const date = new Date(d.date);
                return (date.getMonth() + 1) + "/" + date.getDate();
            });
            dataPoints = data.map(d => d.search_index);
        } else {
            // 데이터가 없으면 안내 메시지용 빈 차트 혹은 기본값
            console.warn(`No trend data for ${targetRegionName}`);
            // 기본값 (빈 그래프 방지용)
            labels = ["데이터 없음"];
            dataPoints = [0];
        }

        if (trendChart) trendChart.destroy();

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `'${displayName} 맛집' 검색량`,
                    data: dataPoints,
                    borderColor: '#F37021',
                    backgroundColor: 'rgba(243, 112, 33, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: '#f1f2f6' } }
                }
            }
        });

    } catch (err) {
        console.error("Supabase Chart Error:", err);
    }
}

// 초기 차트 (빈 껍데기 혹은 전국 평균)
updateChart("전국");


// ---------------------------------------------------------
// 6. UTILITIES
// ---------------------------------------------------------

// 타이핑 효과 함수
function typeWriter(text, elementId) {
    const el = document.getElementById(elementId);
    el.innerHTML = "";
    clearInterval(typeInterval);
    
    let i = 0;
    typeInterval = setInterval(() => {
        if (i < text.length) {
            el.innerHTML += text.charAt(i);
            i++;
        } else {
            clearInterval(typeInterval);
        }
    }, 30);
}

// 맵 로딩 이슈 방지
setTimeout(() => { if(map) map.invalidateSize(); }, 100);

// ---------------------------------------------------------
// 6. SCATTER CHART
// ---------------------------------------------------------
function initScatterChart() {
    const ctx = document.getElementById('scatterChart').getContext('2d');
    
    // Group data by quadrant
    const quadrants = {
        '기회지역': [],
        '경쟁포화지역': [],
        '저관심지역': [],
        '공급과잉': []
    };

    regionData.forEach(r => {
        if (quadrants[r.quadrant]) {
            quadrants[r.quadrant].push({
                x: r.visitor,
                y: r.restaurant,
                regionName: r.name
            });
        }
    });

    const datasets = [
        {
            label: '기회지역',
            data: quadrants['기회지역'],
            backgroundColor: '#F37021',
            borderColor: '#F37021',
            pointRadius: 3,
            pointHoverRadius: 5
        },
        {
            label: '경쟁포화',
            data: quadrants['경쟁포화지역'],
            backgroundColor: '#d63031',
            borderColor: '#d63031',
            pointRadius: 3,
            pointHoverRadius: 5
        },
        {
            label: '저관심',
            data: quadrants['저관심지역'],
            backgroundColor: '#636e72',
            borderColor: '#636e72',
            pointRadius: 3,
            pointHoverRadius: 5
        },
        {
            label: '공급과잉',
            data: quadrants['공급과잉'],
            backgroundColor: '#0984e3',
            borderColor: '#0984e3',
            pointRadius: 3,
            pointHoverRadius: 5
        },
        {
            label: '선택됨',
            data: [],
            backgroundColor: '#000000',
            borderColor: '#000000',
            pointRadius: 8,
            pointHoverRadius: 10,
            pointBorderWidth: 2,
            pointBorderColor: '#fff',
            order: 0 // Draw on top
        }
    ];

    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    labels: {
                        boxWidth: 8,
                        font: { size: 10 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const point = ctx.raw;
                            return `${point.regionName}: ${point.x.toLocaleString()}명, ${point.y}개`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    display: true, 
                    title: { display: true, text: '방문자 수' },
                    ticks: { 
                        callback: (val) => {
                            if(val >= 10000) return (val / 10000).toFixed(0) + '만';
                            return val;
                        },
                        font: { size: 10 }
                    } 
                },
                y: { 
                    display: true, 
                    title: { display: true, text: '식당 수' },
                    ticks: { font: { size: 10 } }
                }
            }
        }
    });
}

function updateScatterHighlight(region) {
    if (!scatterChart) return;
    
    // Update '선택됨' dataset
    scatterChart.data.datasets[4].data = [{
        x: region.visitor,
        y: region.restaurant,
        regionName: region.name
    }];
    scatterChart.update();
}
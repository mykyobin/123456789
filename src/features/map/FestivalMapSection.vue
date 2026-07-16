<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import FestivalFilter from './components/FestivalFilter.vue'
import FestivalMap from './components/FestivalMap.vue'

import festivalJson from '../../../netlify/functions/data/seoul-festivals.json'

import WeatherSummaryCard from '../weather/components/WeatherSummaryCard.vue'

import {
  fetchWeatherForecast,
  getWeatherAvailability,
} from '../weather/services/openMeteo'

import type {
  WeatherForecast,
  WeatherRequestStatus,
} from '../weather/types'

import type {
  Festival,
  FestivalDataset,
} from './types'

// 불러온 JSON의 전체 구조를 FestivalDataset으로 지정
const festivalData =
  festivalJson as FestivalDataset

// 사용자가 선택한 필터값
const selectedDistrict = ref('전체')

// 사용자가 실제 축제에 방문하려는 날짜
const selectedVisitDate = ref('')

// 지도에서 선택한 축제
const selectedFestival =
  ref<Festival | null>(null)

// 날씨 조회 상태
const weatherStatus =
  ref<WeatherRequestStatus>('idle')

const weatherForecast =
  ref<WeatherForecast | null>(null)

const weatherMessage = ref(
  '방문 날짜를 선택하면 서울 중심 기준 날씨를 확인할 수 있습니다.',
)

// 이전 요청보다 늦게 끝난 응답이
// 최신 결과를 덮어쓰는 문제 방지
let weatherRequestSequence = 0

const SEOUL_WEATHER_POINT = {
  latitude: 37.5665,
  longitude: 126.978,
  locationLabel: '서울시청 기준',
}

/*
 * 주소에서 자치구 이름 추출
 *
 * 서울특별시 종로구 대학로 104
 * → 종로구
 */
const extractDistrict = (address = '') => {
  const result = address.match(
    /서울특별(?:시)?\s+([가-힣]+구)/,
  )

  return result ? result[1] : '기타'
}

/*
 * 원본 축제 데이터에 district 속성을 추가
 */
const festivals: Festival[] =
  festivalData.items.map((festival) => {
    return {
      ...festival,

      district: extractDistrict(
        festival.addr1 ?? '',
      ),
    }
  })

/*
 * 중복을 제거한 자치구 목록 생성
 *
 * 종로구, 강남구, 강남구
 * → 강남구, 종로구
 */
const districts = [
  ...new Set(
    festivals
      .map((festival) => {
        return festival.district ?? '기타'
      })
      .filter((district) => {
        return district !== '기타'
      }),
  ),
].sort((a, b) => {
  return a.localeCompare(b, 'ko-KR')
})

/*
 * 날짜 입력창의 값:
 * 2026-07-16
 *
 * 축제 JSON의 값:
 * 20260716
 *
 * 비교할 수 있도록 하이픈 제거
 */
const normalizeInputDate = (date: string) => {
  return date.replaceAll('-', '')
}


/*
 * 필터가 하나라도 적용되어 있는지 확인
 */
const hasActiveFilter = computed(() => {
  return (
    selectedDistrict.value !== '전체' ||
    selectedVisitDate.value !== ''
  )
})

/*
 * 자치구와 기간을 모두 적용한 최종 축제 목록
 */
const filteredFestivals =
  computed<Festival[]>(() => {
    const visitDate =
      normalizeInputDate(
        selectedVisitDate.value,
      )

    return festivals.filter(
      (festival) => {
        /*
         * 1. 자치구 조건
         */
        const districtMatched =
          selectedDistrict.value ===
            '전체' ||
          festival.district ===
            selectedDistrict.value

        if (!districtMatched) {
          return false
        }

        /*
         * 방문 날짜가 선택되지 않았으면
         * 자치구 조건만 적용
         */
        if (!visitDate) {
          return true
        }

        /*
         * 날짜 데이터가 없는 축제는 제외
         */
        if (
          !festival.eventstartdate
        ) {
          return false
        }

        const festivalStart =
          festival.eventstartdate

        const festivalEnd =
          festival.eventenddate ||
          festival.eventstartdate

        /*
         * 방문 날짜가 축제 기간 안에 포함되는지 확인
         */
        return (
          festivalStart <= visitDate &&
          festivalEnd >= visitDate
        )
      },
    )
  })

  

/*
 * 필터 초기화
 */
const handleSelectFestival = (
  festival: Festival,
) => {
  selectedFestival.value = festival
}

const resolveWeatherTarget = () => {
  const festival =
    selectedFestival.value

  if (festival) {
    const latitude =
      Number(festival.mapy)

    const longitude =
      Number(festival.mapx)

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      return {
        latitude,
        longitude,

        locationLabel:
          `${festival.title} 개최지 기준`,
      }
    }
  }

  return SEOUL_WEATHER_POINT
}

const loadWeather = async () => {
  const currentRequest =
    ++weatherRequestSequence

  weatherForecast.value = null

  if (!selectedVisitDate.value) {
    weatherStatus.value = 'idle'

    weatherMessage.value =
      '방문 날짜를 선택하면 서울 중심 기준 날씨를 확인할 수 있습니다.'

    return
  }

  const availability =
    getWeatherAvailability(
      selectedVisitDate.value,
    )

  if (!availability.available) {
    weatherStatus.value =
      'unavailable'

    weatherMessage.value =
      availability.reason ||
      '해당 날짜의 예보는 아직 제공되지 않습니다.'

    return
  }

  const target =
    resolveWeatherTarget()

  weatherStatus.value = 'loading'

  weatherMessage.value =
    '날씨를 불러오는 중입니다.'

  try {
    const forecast =
      await fetchWeatherForecast({
        latitude: target.latitude,
        longitude: target.longitude,
        date: selectedVisitDate.value,
        locationLabel:
          target.locationLabel,
      })

    /*
     * 사용자가 요청 중 다른 날짜나
     * 다른 축제를 선택한 경우
     * 이전 요청 결과를 무시
     */
    if (
      currentRequest !==
      weatherRequestSequence
    ) {
      return
    }

    weatherForecast.value =
      forecast

    weatherStatus.value =
      'success'

    weatherMessage.value = ''
  } catch (error) {
    if (
      currentRequest !==
      weatherRequestSequence
    ) {
      return
    }

    weatherStatus.value = 'error'

    weatherMessage.value =
      error instanceof Error
        ? error.message
        : '날씨를 불러오는 중 오류가 발생했습니다.'
  }
}

/*
 * 방문 날짜 또는 선택 축제가 바뀌면
 * 날씨를 다시 조회
 */
watch(
  [
    selectedVisitDate,
    selectedFestival,
  ],
  () => {
    void loadWeather()
  },
  {
    immediate: true,
  },
)

/*
 * 필터 변경으로 선택한 축제가
 * 현재 검색 결과에서 사라졌다면 선택 해제
 */
watch(
  filteredFestivals,
  (currentFestivals) => {
    const selected =
      selectedFestival.value

    if (!selected) {
      return
    }

    const isStillVisible =
      currentFestivals.some(
        (festival) => {
          return (
            festival.contentid ===
            selected.contentid
          )
        },
      )

    if (!isStillVisible) {
      selectedFestival.value =
        null
    }
  },
)

const resetFilters = () => {
  selectedDistrict.value = '전체'
  selectedVisitDate.value = ''
  selectedFestival.value = null
}
</script>

<template>
  <section
    id="festivals"
    class="map-feature-section"
  >
    <!-- 제목 영역 -->
    <header class="map-feature-header">
      <div class="map-feature-heading">
        <span class="map-feature-kicker">
          Seoul Festival Map
        </span>

        <h2>
          서울의 축제를
          <strong>지도에서 찾아보세요.</strong>
        </h2>

        <p>
          원하는 자치구와 방문 예정일을 선택하면
          그날 진행되는 축제와 날씨를 함께 확인할 수 있습니다.
        </p>
      </div>

      <div class="map-feature-result">
        <span>검색 결과</span>

        <strong>
          {{ filteredFestivals.length }}
          <small>개</small>
        </strong>

        <p>
          전체 {{ festivals.length }}개 행사
        </p>
      </div>
    </header>

    <!-- 필터 영역 -->
    <div class="map-feature-filter-card">
      <div class="map-feature-filter-header">
        <div>
          <span>축제 검색 조건</span>

          <strong>
            지역과 방문 예정일을 선택해 주세요.
          </strong>
        </div>

        <button
          v-if="hasActiveFilter"
          type="button"
          class="map-feature-reset"
          @click="resetFilters"
        >
          필터 초기화
        </button>
      </div>

      <div class="map-feature-filter-grid">
        <!-- 자치구 필터 -->
        <FestivalFilter
          v-model="selectedDistrict"
          :districts="districts"
        />

        <div class="map-feature-date-field">
          <label for="festival-visit-date">
            방문 예정일
          </label>

        <div class="map-feature-date-input">
          <span aria-hidden="true">
            📅
          </span>

          <input
            id="festival-visit-date"
            v-model="selectedVisitDate"
            type="date"
          />
        </div>
      </div>
      </div>
    </div>

    <!-- 지도 영역 -->
    <div
      v-if="selectedFestival"
      class="map-feature-selected"
    >
      <div>
        <span>선택한 축제</span>

        <strong>
          {{ selectedFestival.title }}
        </strong>
      </div>

      <p>
        {{
          selectedFestival.eventplace ||
          selectedFestival.addr1 ||
          '장소 정보 없음'
        }}
      </p>
    </div>

    <!-- 날씨 카드 추가 위치 -->
    <WeatherSummaryCard
      :status="weatherStatus"
      :forecast="weatherForecast"
      :message="weatherMessage"
      :selected-date="selectedVisitDate"
    />

    <!-- 기존 지도 카드 -->
    <div class="map-feature-card">
      <div class="map-feature-card-header">
        <div>
          <span class="map-feature-live-dot"></span>
          축제 위치
        </div>

        <span>
          마커를 누르면 상세 정보를 확인할 수 있습니다.
        </span>
      </div>

      <div class="map-feature-area">
        <FestivalMap
          :festivals="filteredFestivals"
          @select-festival="handleSelectFestival"
        />

        <!-- 검색 결과가 없을 때 -->
        <div
          v-if="filteredFestivals.length === 0"
          class="map-feature-empty"
        >
          <span aria-hidden="true">
            🗺️
          </span>

          <strong>
            조건에 맞는 축제가 없습니다.
          </strong>

          <p>
            지역이나 기간을 다시 선택해 주세요.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-feature-selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;

  margin-bottom: 18px;
  padding: 17px 20px;

  border: 1px solid #cad6ff;
  border-radius: 16px;
  background: #edf2ff;
}

.map-feature-selected > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.map-feature-selected span {
  color: #3165ff;
  font-size: 11px;
  font-weight: 900;
}

.map-feature-selected strong {
  color: #172033;
  font-size: 16px;
}

.map-feature-selected p {
  margin: 0;

  color: #69758c;
  font-size: 13px;
  text-align: right;
}

@media (max-width: 800px) {
  .map-feature-selected {
    align-items: flex-start;
    flex-direction: column;
  }

  .map-feature-selected p {
    text-align: left;
  }
}
.map-feature-section {
  width: min(1120px, calc(100% - 40px));
  margin: 0 auto;
  padding: 76px 0 90px;
}

/* 제목 영역 */

.map-feature-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 40px;

  margin-bottom: 28px;
}

.map-feature-kicker {
  color: #3165ff;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.map-feature-heading h2 {
  margin: 10px 0 12px;

  color: #15213a;
  font-size: 36px;
  line-height: 1.25;
  letter-spacing: -0.04em;
}

.map-feature-heading h2 strong {
  color: #3165ff;
}

.map-feature-heading p {
  margin: 0;

  color: #69758c;
  font-size: 15px;
  line-height: 1.7;
}

/* 검색 결과 카드 */

.map-feature-result {
  flex: 0 0 185px;
  padding: 18px 20px;

  border: 1px solid #dfe5ef;
  border-radius: 18px;
  background: #ffffff;

  box-shadow:
    0 16px 42px rgba(31, 51, 91, 0.08);
}

.map-feature-result > span {
  color: #7c879a;
  font-size: 12px;
  font-weight: 700;
}

.map-feature-result strong {
  display: block;
  margin: 6px 0 5px;

  color: #3165ff;
  font-size: 30px;
  line-height: 1;
}

.map-feature-result small {
  font-size: 14px;
}

.map-feature-result p {
  margin: 0;

  color: #8a94a6;
  font-size: 11px;
}

/* 필터 카드 */

.map-feature-filter-card {
  margin-bottom: 18px;
  padding: 22px;

  border: 1px solid #e1e6ef;
  border-radius: 20px;
  background: #ffffff;

  box-shadow:
    0 14px 36px rgba(31, 51, 91, 0.06);
}

.map-feature-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 20px;
}

.map-feature-filter-header > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.map-feature-filter-header span {
  color: #3165ff;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.map-feature-filter-header strong {
  color: #172033;
  font-size: 16px;
}

.map-feature-filter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

/* 날짜 입력 */

.map-feature-date-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-feature-date-field label {
  color: #172033;
  font-size: 14px;
  font-weight: 800;
}

.map-feature-date-input {
  position: relative;
}

.map-feature-date-input > span {
  position: absolute;
  top: 50%;
  left: 14px;

  transform: translateY(-50%);
  pointer-events: none;
}

.map-feature-date-input input {
  width: 100%;
  height: 48px;
  padding: 0 14px 0 42px;

  color: #172033;
  border: 1px solid #dfe5ef;
  border-radius: 12px;
  background: #ffffff;

  font: inherit;

  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.map-feature-date-input input:hover {
  border-color: #8aa5ff;
}

.map-feature-date-input input:focus {
  border-color: #3165ff;
  outline: none;

  box-shadow:
    0 0 0 4px rgba(49, 101, 255, 0.1);
}

/* 초기화 버튼 */

.map-feature-reset {
  padding: 9px 13px;

  color: #2757e6;
  border: 1px solid #cad6ff;
  border-radius: 10px;
  background: #edf2ff;

  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.map-feature-reset:hover {
  border-color: #8aa5ff;
  background: #e3eaff;
}

/* 지도 카드 */

.map-feature-card {
  padding: 12px;

  border: 1px solid #e1e6ef;
  border-radius: 22px;
  background: #ffffff;

  box-shadow:
    0 22px 55px rgba(31, 51, 91, 0.12);
}

.map-feature-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  height: 44px;
  padding: 0 8px 10px;

  color: #7c879a;
  font-size: 12px;
}

.map-feature-card-header > div {
  display: flex;
  align-items: center;
  gap: 9px;

  color: #172033;
  font-size: 14px;
  font-weight: 800;
}

.map-feature-live-dot {
  width: 9px;
  height: 9px;

  border-radius: 50%;
  background: #3165ff;

  box-shadow:
    0 0 0 5px rgba(49, 101, 255, 0.12);
}

.map-feature-area {
  position: relative;
}

/* 검색 결과 없음 */

.map-feature-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 500;

  display: flex;
  flex-direction: column;
  align-items: center;

  min-width: 270px;
  padding: 25px;

  border: 1px solid #dfe5ef;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);

  transform: translate(-50%, -50%);

  box-shadow:
    0 16px 40px rgba(31, 51, 91, 0.14);
}

.map-feature-empty > span {
  margin-bottom: 9px;
  font-size: 34px;
}

.map-feature-empty strong {
  color: #172033;
}

.map-feature-empty p {
  margin: 6px 0 0;

  color: #7c879a;
  font-size: 13px;
}

/* 모바일 */

@media (max-width: 800px) {
  .map-feature-header {
    align-items: stretch;
    flex-direction: column;
  }

  .map-feature-result {
    flex: auto;
  }

  .map-feature-filter-grid {
    grid-template-columns: 1fr;
  }

  .map-feature-heading h2 {
    font-size: 30px;
  }

  .map-feature-card-header > span {
    display: none;
  }
}
</style>
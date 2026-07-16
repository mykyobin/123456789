<script setup lang="ts">
import type {
  WeatherForecast,
  WeatherRequestStatus,
} from '../types'

defineProps<{
  status: WeatherRequestStatus
  forecast: WeatherForecast | null
  message: string
  selectedDate: string
}>()

const formatDate = (
  dateString: string,
) => {
  if (!dateString) {
    return '날짜 미선택'
  }

  const date = new Date(
    `${dateString}T00:00:00`,
  )

  return new Intl.DateTimeFormat(
    'ko-KR',
    {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    },
  ).format(date)
}

const formatTemperature = (
  value: number | null,
) => {
  return value === null
    ? '-'
    : `${Math.round(value)}°`
}

const formatPercent = (
  value: number | null,
) => {
  return value === null
    ? '-'
    : `${Math.round(value)}%`
}

const formatMillimeter = (
  value: number | null,
) => {
  return value === null
    ? '-'
    : `${value.toFixed(1)}mm`
}
</script>

<template>
  <section
    class="weather-summary"
    :class="[
      `weather-summary--${
        forecast?.theme ?? 'neutral'
      }`,
    ]"
  >
    <div class="weather-summary-header">
      <div>
        <span class="weather-summary-kicker">
          FESTIVAL WEATHER
        </span>

        <strong>
          방문일 날씨
        </strong>
      </div>

      <span class="weather-summary-date">
        {{ formatDate(selectedDate) }}
      </span>
    </div>

    <!-- 날씨 조회 성공 -->
    <div
      v-if="
        status === 'success' &&
        forecast
      "
      class="weather-summary-content"
    >
      <div class="weather-summary-main">
        <span
          class="weather-summary-icon"
          aria-hidden="true"
        >
          {{ forecast.icon }}
        </span>

        <div>
          <strong>
            {{ forecast.description }}
          </strong>

          <p>
            {{ forecast.locationLabel }}
          </p>
        </div>
      </div>

      <div class="weather-summary-metrics">
        <div>
          <span>최고 / 최저</span>

          <strong>
            {{
              formatTemperature(
                forecast.temperatureMax,
              )
            }}
            /
            {{
              formatTemperature(
                forecast.temperatureMin,
              )
            }}
          </strong>
        </div>

        <div>
          <span>강수확률</span>

          <strong>
            {{
              formatPercent(
                forecast
                  .precipitationProbabilityMax,
              )
            }}
          </strong>
        </div>

        <div>
          <span>
            {{
              forecast.theme === 'snow'
                ? '예상 적설량'
                : '예상 강수량'
            }}
          </span>

          <strong>
            {{
              formatMillimeter(
                forecast.theme === 'snow'
                  ? forecast.snowfallSum
                  : forecast.precipitationSum,
              )
            }}
          </strong>
        </div>
      </div>
    </div>

    <!-- 로딩 -->
    <div
      v-else-if="status === 'loading'"
      class="weather-summary-state"
    >
      <span
        class="weather-loading-spinner"
        aria-hidden="true"
      ></span>

      <div>
        <strong>
          날씨를 확인하고 있습니다.
        </strong>

        <p>
          선택한 위치의 예보를 불러오는 중입니다.
        </p>
      </div>
    </div>

    <!-- 날짜 미선택, 예보 범위 밖, 오류 -->
    <div
      v-else
      class="weather-summary-state"
    >
      <span
        class="weather-summary-state-icon"
        aria-hidden="true"
      >
        {{
          status === 'error'
            ? '⚠️'
            : status === 'unavailable'
              ? '📆'
              : '🌤️'
        }}
      </span>

      <div>
        <strong>
          {{
            status === 'error'
              ? '날씨를 불러오지 못했습니다.'
              : status === 'unavailable'
                ? '아직 예보를 확인할 수 없습니다.'
                : '방문 날짜를 선택해 주세요.'
          }}
        </strong>

        <p>
          {{ message }}
        </p>
      </div>
    </div>

    <footer class="weather-summary-source">
      Weather data by Open-Meteo
    </footer>
  </section>
</template>

<style scoped>
.weather-summary {
  position: relative;
  overflow: hidden;

  margin-bottom: 18px;
  padding: 22px;

  color: #172033;
  border: 1px solid #dfe5ef;
  border-radius: 20px;
  background: #ffffff;

  box-shadow:
    0 14px 36px rgba(31, 51, 91, 0.07);

  transition:
    background 0.3s,
    border-color 0.3s;
}

.weather-summary--clear {
  border-color: #f0d78a;
  background:
    radial-gradient(
      circle at 90% 10%,
      rgba(255, 210, 66, 0.25),
      transparent 30%
    ),
    #fffdf5;
}

.weather-summary--cloudy {
  background:
    linear-gradient(
      135deg,
      #f7f9fc,
      #e9eef6
    );
}

.weather-summary--rain,
.weather-summary--thunder {
  border-color: #b9c9eb;
  background:
    linear-gradient(
      135deg,
      #f2f6ff,
      #e3ebfa
    );
}

.weather-summary--snow {
  border-color: #cfe3f3;
  background:
    linear-gradient(
      135deg,
      #ffffff,
      #edf7ff
    );
}

.weather-summary-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;

  margin-bottom: 20px;
}

.weather-summary-header > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.weather-summary-kicker {
  color: #3165ff;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.weather-summary-header strong {
  font-size: 17px;
}

.weather-summary-date {
  padding: 7px 10px;

  color: #52617a;
  border: 1px solid rgba(49, 101, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);

  font-size: 12px;
  font-weight: 700;
}

.weather-summary-content {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  align-items: center;
  gap: 24px;
}

.weather-summary-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.weather-summary-icon {
  font-size: 54px;
  line-height: 1;
}

.weather-summary-main strong {
  display: block;

  color: #172033;
  font-size: 24px;
}

.weather-summary-main p {
  margin: 6px 0 0;

  color: #69758c;
  font-size: 13px;
  line-height: 1.5;
}

.weather-summary-metrics {
  display: grid;
  grid-template-columns: repeat(
    3,
    minmax(0, 1fr)
  );
  gap: 10px;
}

.weather-summary-metrics > div {
  padding: 14px;

  border: 1px solid rgba(49, 101, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.74);
}

.weather-summary-metrics span {
  display: block;

  color: #7c879a;
  font-size: 11px;
  font-weight: 700;
}

.weather-summary-metrics strong {
  display: block;
  margin-top: 7px;

  color: #172033;
  font-size: 17px;
}

.weather-summary-state {
  display: flex;
  align-items: center;
  gap: 14px;

  min-height: 84px;
  padding: 16px;

  border-radius: 14px;
  background: rgba(247, 249, 252, 0.8);
}

.weather-summary-state-icon {
  font-size: 32px;
}

.weather-summary-state strong {
  color: #172033;
  font-size: 14px;
}

.weather-summary-state p {
  margin: 5px 0 0;

  color: #69758c;
  font-size: 12px;
  line-height: 1.5;
}

.weather-loading-spinner {
  width: 28px;
  height: 28px;

  border: 3px solid #dbe4ff;
  border-top-color: #3165ff;
  border-radius: 50%;

  animation:
    weather-spin 0.8s linear infinite;
}

.weather-summary-source {
  margin-top: 14px;

  color: #97a0b0;
  font-size: 10px;
  text-align: right;
}

@keyframes weather-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 800px) {
  .weather-summary-content {
    grid-template-columns: 1fr;
  }

  .weather-summary-metrics {
    grid-template-columns: 1fr;
  }

  .weather-summary-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
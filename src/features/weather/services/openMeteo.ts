import {
  getWeatherPresentation,
} from '../weatherCode'

import type {
  OpenMeteoDailyResponse,
  WeatherAvailability,
  WeatherForecast,
} from '../types'

const OPEN_METEO_ENDPOINT =
  'https://api.open-meteo.com/v1/forecast'

const FORECAST_DAY_COUNT = 16

const weatherCache =
  new Map<string, WeatherForecast>()

const createDateAtMidnight = (
  dateString: string,
) => {
  return new Date(`${dateString}T00:00:00`)
}

const getTodayAtMidnight = () => {
  const today = new Date()

  today.setHours(0, 0, 0, 0)

  return today
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const getWeatherAvailability = (
  dateString: string,
): WeatherAvailability => {
  if (!dateString) {
    return {
      available: false,
      reason: '방문 날짜를 먼저 선택해 주세요.',
    }
  }

  const selectedDate =
    createDateAtMidnight(dateString)

  if (Number.isNaN(selectedDate.getTime())) {
    return {
      available: false,
      reason: '날짜 형식이 올바르지 않습니다.',
    }
  }

  const today = getTodayAtMidnight()

  if (selectedDate < today) {
    return {
      available: false,
      reason: '지난 날짜의 예보는 제공하지 않습니다.',
    }
  }

  const lastForecastDate = new Date(today)

  lastForecastDate.setDate(
    today.getDate() +
      FORECAST_DAY_COUNT -
      1,
  )

  if (selectedDate > lastForecastDate) {
    return {
      available: false,
      reason:
        `현재 예보는 ${formatLocalDate(
          lastForecastDate,
        )}까지 확인할 수 있습니다.`,
    }
  }

  return {
    available: true,
  }
}

const toNullableNumber = (
  value: number | null | undefined,
) => {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  )
    ? value
    : null
}

interface FetchWeatherOptions {
  latitude: number
  longitude: number
  date: string
  locationLabel: string
}

export const fetchWeatherForecast = async ({
  latitude,
  longitude,
  date,
  locationLabel,
}: FetchWeatherOptions): Promise<WeatherForecast> => {
  const availability =
    getWeatherAvailability(date)

  if (!availability.available) {
    throw new Error(
      availability.reason ||
        '해당 날짜의 예보를 조회할 수 없습니다.',
    )
  }

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      '날씨를 조회할 위치 정보가 없습니다.',
    )
  }

  const cacheKey = [
    latitude.toFixed(4),
    longitude.toFixed(4),
    date,
  ].join(':')

  const cachedForecast =
    weatherCache.get(cacheKey)

  if (cachedForecast) {
    return {
      ...cachedForecast,
      locationLabel,
    }
  }

  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),

    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'snowfall_sum',
    ].join(','),

    timezone: 'Asia/Seoul',
    start_date: date,
    end_date: date,
  })

  const response = await fetch(
    `${OPEN_METEO_ENDPOINT}?${query.toString()}`,
  )

  if (!response.ok) {
    throw new Error(
      `날씨 요청에 실패했습니다. (${response.status})`,
    )
  }

  const data =
    await response.json() as OpenMeteoDailyResponse

  if (data.error) {
    throw new Error(
      data.reason ||
        '날씨 API 오류가 발생했습니다.',
    )
  }

  const weatherCode =
    data.daily?.weather_code?.[0]

  if (typeof weatherCode !== 'number') {
    throw new Error(
      '해당 날짜의 날씨 데이터가 없습니다.',
    )
  }

  const presentation =
    getWeatherPresentation(weatherCode)

  const forecast: WeatherForecast = {
    date:
      data.daily?.time?.[0] ||
      date,

    weatherCode,
    theme: presentation.theme,
    description: presentation.description,
    icon: presentation.icon,

    temperatureMax:
      toNullableNumber(
        data.daily?.temperature_2m_max?.[0],
      ),

    temperatureMin:
      toNullableNumber(
        data.daily?.temperature_2m_min?.[0],
      ),

    precipitationProbabilityMax:
      toNullableNumber(
        data.daily
          ?.precipitation_probability_max?.[0],
      ),

    precipitationSum:
      toNullableNumber(
        data.daily?.precipitation_sum?.[0],
      ),

    snowfallSum:
      toNullableNumber(
        data.daily?.snowfall_sum?.[0],
      ),

    latitude,
    longitude,
    locationLabel,
  }

  weatherCache.set(cacheKey, forecast)

  return forecast
}
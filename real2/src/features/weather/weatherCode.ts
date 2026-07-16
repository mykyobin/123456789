import type {
  WeatherPresentation,
} from './types'

export const getWeatherPresentation = (
  weatherCode: number,
): WeatherPresentation => {
  if (
    weatherCode === 0 ||
    weatherCode === 1
  ) {
    return {
      theme: 'clear',
      description: '맑음',
      icon: '☀️',
    }
  }

  if (
    weatherCode === 2 ||
    weatherCode === 3 ||
    weatherCode === 45 ||
    weatherCode === 48
  ) {
    return {
      theme: 'cloudy',
      description: '흐림',
      icon: '☁️',
    }
  }

  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return {
      theme: 'rain',
      description: '비',
      icon: '🌧️',
    }
  }

  if (
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 85 && weatherCode <= 86)
  ) {
    return {
      theme: 'snow',
      description: '눈',
      icon: '❄️',
    }
  }

  if (
    weatherCode >= 95 &&
    weatherCode <= 99
  ) {
    return {
      theme: 'thunder',
      description: '천둥·번개',
      icon: '⛈️',
    }
  }

  return {
    theme: 'neutral',
    description: '날씨 정보 없음',
    icon: '🌤️',
  }
}
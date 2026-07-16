export type WeatherTheme =
  | 'neutral'
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'thunder'

export type WeatherRequestStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'unavailable'
  | 'error'

export interface WeatherPresentation {
  theme: WeatherTheme
  description: string
  icon: string
}

export interface WeatherForecast {
  date: string

  weatherCode: number
  theme: WeatherTheme
  description: string
  icon: string

  temperatureMax: number | null
  temperatureMin: number | null

  precipitationProbabilityMax: number | null
  precipitationSum: number | null
  snowfallSum: number | null

  latitude: number
  longitude: number
  locationLabel: string
}

export interface WeatherAvailability {
  available: boolean
  reason?: string
}

export interface OpenMeteoDailyResponse {
  latitude: number
  longitude: number

  error?: boolean
  reason?: string

  daily?: {
    time?: string[]
    weather_code?: Array<number | null>
    temperature_2m_max?: Array<number | null>
    temperature_2m_min?: Array<number | null>
    precipitation_probability_max?: Array<number | null>
    precipitation_sum?: Array<number | null>
    snowfall_sum?: Array<number | null>
  }
}
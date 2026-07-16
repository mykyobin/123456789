<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import type { Festival } from '../types'

const props = defineProps<{
  festivals: Festival[]
  focusFestival?: Festival | null
  focusRequestId?: number
}>()

const emit = defineEmits<{
  'select-festival': [festival: Festival]
}>()

const mapContainer = ref<HTMLElement | null>(null)

let map: L.Map | null = null
let markerLayer: L.LayerGroup | null = null
let focusMarkerLayer: L.LayerGroup | null = null
let focusedContentId: string | null = null

const markerByContentId = new Map<string, L.Marker>()

const SEOUL_CENTER: L.LatLngExpression = [
  37.5665,
  126.978,
]

const SEOUL_ZOOM = 11
const FOCUS_ZOOM = 15

const festivalIcon = L.divIcon({
  className: 'festival-marker-shell',
  html: `
    <div class="festival-marker">
      <span>★</span>
    </div>
  `,
  iconSize: [38, 46],
  iconAnchor: [19, 46],
  popupAnchor: [0, -42],
})

const focusedFestivalIcon = L.divIcon({
  className: 'festival-marker-shell festival-marker-shell-focused',
  html: `
    <div class="festival-marker is-focused">
      <span>★</span>
    </div>
  `,
  iconSize: [44, 52],
  iconAnchor: [22, 52],
  popupAnchor: [0, -48],
})

const escapeHtml = (value = '') => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const formatDate = (date?: string) => {
  if (!date || date.length !== 8) {
    return '일정 정보 없음'
  }

  return [
    date.slice(0, 4),
    date.slice(4, 6),
    date.slice(6, 8),
  ].join('.')
}

const formatPeriod = (
  startDate?: string,
  endDate?: string,
) => {
  if (!startDate) {
    return '일정 정보 없음'
  }

  if (!endDate || startDate === endDate) {
    return formatDate(startDate)
  }

  return `${formatDate(startDate)} ~ ${formatDate(endDate)}`
}

const isValidSeoulCoordinate = (
  latitude: number,
  longitude: number,
) => {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= 37.4 &&
    latitude <= 37.75 &&
    longitude >= 126.7 &&
    longitude <= 127.3
  )
}

const createPopupContent = (festival: Festival) => {
  const imageArea = festival.firstimage
    ? `
      <div class="festival-popup-image-area">
        <div class="festival-popup-placeholder">
          🎉
        </div>

        <img
          src="${escapeHtml(festival.firstimage)}"
          alt="${escapeHtml(festival.title)}"
          onerror="this.style.display='none'"
        />
      </div>
    `
    : `
      <div class="festival-popup-placeholder">
        🎉
      </div>
    `

  const place =
    festival.eventplace ||
    festival.addr1 ||
    '장소 정보 없음'

  const price =
    festival.usetimefestival ||
    '요금 정보 없음'

  return `
    <article class="festival-popup">
      ${imageArea}

      <div class="festival-popup-body">
        <span class="festival-popup-badge">
          서울 축제
        </span>

        <strong class="festival-popup-title">
          ${escapeHtml(festival.title)}
        </strong>

        <div class="festival-popup-info">
          <p>
            <span>📅</span>
            <span>
              ${formatPeriod(
                festival.eventstartdate,
                festival.eventenddate,
              )}
            </span>
          </p>

          <p>
            <span>📍</span>
            <span>
              ${escapeHtml(place)}
            </span>
          </p>

          <p>
            <span>🎫</span>
            <span>
              ${escapeHtml(price)}
            </span>
          </p>
        </div>
      </div>
    </article>
  `
}

function createFestivalMarker(
  festival: Festival,
  icon: L.DivIcon = festivalIcon,
): L.Marker | null {
  const latitude = Number(festival.mapy)
  const longitude = Number(festival.mapx)

  if (!isValidSeoulCoordinate(latitude, longitude)) {
    return null
  }

  const marker = L.marker(
    [latitude, longitude],
    {
      icon,
      title: festival.title,
    },
  )

  marker.on('click', () => {
    emit('select-festival', festival)
  })

  marker.bindPopup(
    createPopupContent(festival),
    {
      minWidth: 260,
      maxWidth: 290,
      autoPan: false,
    },
  )

  return marker
}

function clearFocusedMarker(): void {
  if (focusedContentId) {
    markerByContentId
      .get(focusedContentId)
      ?.setIcon(festivalIcon)
  }

  focusMarkerLayer?.clearLayers()
  focusedContentId = null
}

function applyFocusedFestival(moveMap: boolean): void {
  if (!map || !focusMarkerLayer) return

  const festival = props.focusFestival
  if (!festival || !props.focusRequestId) {
    clearFocusedMarker()
    return
  }

  const latitude = Number(festival.mapy)
  const longitude = Number(festival.mapx)

  if (!isValidSeoulCoordinate(latitude, longitude)) {
    clearFocusedMarker()
    return
  }

  clearFocusedMarker()

  let marker = markerByContentId.get(festival.contentid) ?? null

  if (marker) {
    marker.setIcon(focusedFestivalIcon)
  } else {
    marker = createFestivalMarker(festival, focusedFestivalIcon)
    marker?.addTo(focusMarkerLayer)
  }

  if (!marker) return

  focusedContentId = festival.contentid

  if (!moveMap) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduceMotion) {
    map.setView([latitude, longitude], FOCUS_ZOOM)
    marker.openPopup()
    return
  }

  map.flyTo(
    [latitude, longitude],
    FOCUS_ZOOM,
    {
      animate: true,
      duration: 0.85,
      easeLinearity: 0.25,
    },
  )

  window.setTimeout(() => {
    marker?.openPopup()
  }, 360)
}

const renderMarkers = (
  fitToMarkers = false,
) => {
  if (!map || !markerLayer) {
    return
  }

  const currentMap = map
  const currentMarkerLayer = markerLayer

  currentMarkerLayer.clearLayers()
  markerByContentId.clear()

  const bounds: L.LatLngExpression[] = []

  props.festivals.forEach((festival) => {
    const marker = createFestivalMarker(festival)
    if (!marker) return

    marker.addTo(currentMarkerLayer)
    markerByContentId.set(festival.contentid, marker)

    bounds.push([
      Number(festival.mapy),
      Number(festival.mapx),
    ])
  })

  if (!fitToMarkers) {
    currentMap.setView(
      SEOUL_CENTER,
      SEOUL_ZOOM,
    )
  } else if (bounds.length > 0) {
    currentMap.fitBounds(
      L.latLngBounds(bounds),
      {
        padding: [40, 40],
        maxZoom: 14,
      },
    )
  } else {
    currentMap.setView(
      SEOUL_CENTER,
      SEOUL_ZOOM,
    )
  }

  applyFocusedFestival(false)
}

onMounted(() => {
  if (!mapContainer.value) {
    return
  }

  map = L.map(
    mapContainer.value,
    {
      center: SEOUL_CENTER,
      zoom: SEOUL_ZOOM,
      minZoom: 10,
      maxBounds: [
        [37.3, 126.55],
        [37.85, 127.45],
      ],
      maxBoundsViscosity: 0.7,
    },
  )

  L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution:
        '&copy; OpenStreetMap contributors',
    },
  ).addTo(map)

  markerLayer = L.layerGroup().addTo(map)
  focusMarkerLayer = L.layerGroup().addTo(map)

  renderMarkers(false)

  if (props.focusFestival && props.focusRequestId) {
    applyFocusedFestival(true)
  }

  window.setTimeout(() => {
    map?.invalidateSize()
  }, 0)
})

watch(
  () => props.festivals,
  () => {
    renderMarkers(true)
  },
)

watch(
  [
    () => props.focusRequestId,
    () => props.focusFestival,
  ],
  () => {
    applyFocusedFestival(Boolean(props.focusFestival))
  },
)

onBeforeUnmount(() => {
  clearFocusedMarker()
  markerByContentId.clear()
  map?.remove()

  map = null
  markerLayer = null
  focusMarkerLayer = null
})
</script>

<template>
  <div
    ref="mapContainer"
    class="festival-map"
    aria-label="서울 축제 위치 지도"
  ></div>
</template>

<style>
.festival-map {
  width: 100%;
  height: 620px;
  overflow: hidden;

  border-radius: 18px;
  background: #e9eefb;
}

/* =========================
   축제 마커
========================= */

.festival-marker-shell {
  border: none;
  background: transparent;
}

.festival-marker {
  position: relative;

  display: grid;
  width: 36px;
  height: 36px;

  color: #ffffff;
  border: 3px solid #ffffff;
  border-radius: 50%;
  background: #3165ff;

  font-size: 14px;

  box-shadow:
    0 7px 18px rgba(49, 101, 255, 0.34),
    0 0 0 3px rgba(49, 101, 255, 0.12);

  place-items: center;
}

.festival-marker::after {
  position: absolute;
  bottom: -7px;
  left: 50%;

  width: 12px;
  height: 12px;

  border-right: 3px solid #ffffff;
  border-bottom: 3px solid #ffffff;
  background: #3165ff;

  content: '';
  transform:
    translateX(-50%)
    rotate(45deg);
}

.festival-marker.is-focused {
  width: 42px;
  height: 42px;
  background: #6548e8;
  box-shadow:
    0 10px 24px rgba(73, 50, 190, 0.42),
    0 0 0 6px rgba(101, 72, 232, 0.18);
  transform: translateY(-2px);
}

.festival-marker.is-focused::after {
  background: #6548e8;
}

/* =========================
   Leaflet 팝업 기본 스타일
========================= */

.festival-map
  .leaflet-popup-content-wrapper {
  overflow: hidden;
  padding: 0;

  border-radius: 18px;

  box-shadow:
    0 18px 45px
    rgba(31, 51, 91, 0.22);
}

.festival-map
  .leaflet-popup-content {
  width: 270px !important;
  margin: 0;
}

.festival-map
  .leaflet-popup-tip {
  background: #ffffff;
}

/* =========================
   축제 팝업 내부
========================= */

.festival-popup {
  overflow: hidden;
  background: #ffffff;
}

.festival-popup-image-area {
  position: relative;

  width: 100%;
  height: 145px;

  overflow: hidden;
}

.festival-popup-image-area img {
  position: absolute;
  inset: 0;

  width: 100%;
  height: 100%;

  object-fit: cover;
}

.festival-popup-placeholder {
  display: grid;
  width: 100%;
  height: 145px;

  color: #3165ff;

  background:
    radial-gradient(
      circle at 75% 25%,
      rgba(49, 101, 255, 0.2),
      transparent 32%
    ),
    #edf2ff;

  font-size: 38px;
  place-items: center;
}

.festival-popup-body {
  padding: 17px;
}

.festival-popup-badge {
  display: inline-flex;

  margin-bottom: 8px;
  padding: 5px 9px;

  color: #2757e6;
  border-radius: 999px;
  background: #edf2ff;

  font-size: 10px;
  font-weight: 900;
}

.festival-popup-title {
  display: block;

  margin-bottom: 13px;

  color: #172033;

  font-size: 17px;
  line-height: 1.45;

  word-break: keep-all;
}

.festival-popup-info {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.festival-popup-info p {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  margin: 0;

  color: #69758c;

  font-size: 12px;
  line-height: 1.55;

  word-break: keep-all;
}

.festival-popup-info p > span:first-child {
  flex: 0 0 auto;
}

/* =========================
   지도 확대·축소 버튼
========================= */

.festival-map
  .leaflet-control-zoom {
  overflow: hidden;

  border: none !important;
  border-radius: 12px !important;

  box-shadow:
    0 8px 24px
    rgba(31, 51, 91, 0.18) !important;
}

.festival-map
  .leaflet-control-zoom a {
  color: #2757e6 !important;

  border-bottom-color:
    #e7ebf2 !important;
}

@media (max-width: 800px) {
  .festival-map {
    height: 520px;
  }
}
</style>
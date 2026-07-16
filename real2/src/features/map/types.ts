// 축제 한 건의 데이터 구조
export interface Festival {
  contentid: string
  title: string

  addr1?: string
  addr2?: string
  eventplace?: string

  // JSON에서는 좌표가 문자열로 저장되어 있음
  mapx?: string
  mapy?: string

  firstimage?: string
  firstimage2?: string

  eventstartdate?: string
  eventenddate?: string

  playtime?: string
  program?: string

  tel?: string
  agelimit?: string
  usetimefestival?: string

  // 주소에서 별도로 추출하여 추가할 값
  district?: string
}

// JSON 파일 전체의 구조
export interface FestivalDataset {
  region: string
  contentType: string
  contentTypeId: number
  total: number
  items: Festival[]
}

export interface FestivalMapFocusRequest {
  requestId: number
  contentId: string
  title: string
  latitude: number
  longitude: number
}

export function createConversationFallback(question: string): string {
  const normalized = question.toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim()

  if (/^(안녕|안녕하세요|ㅎㅇ|하이|hello|hi)/i.test(normalized)) {
    return '안녕하세요! 저는 서울 축제·공연·행사 정보를 안내하는 AI 챗봇입니다. 편하게 질문해 주세요.'
  }

  if (/(너 누구|누구야|누구세요|정체)/.test(normalized)) {
    return '저는 서울의 축제·공연·행사 정보를 찾아주고, 간단한 대화도 할 수 있는 AI 챗봇입니다.'
  }

  if (/(고마워|고맙|감사|thanks|thank you)/i.test(normalized)) {
    return '도움이 되었다니 다행이에요!'
  }

  if (/(뭐 할 수|무엇을 할 수|도움말|사용법)/.test(normalized)) {
    return '간단한 대화를 할 수 있고, 서울 행사 이름·지역·날짜·무료 여부·장소·요금 등을 찾아드릴 수 있어요.'
  }

  if (/(요금|가격|얼마)/.test(normalized)) {
    return '어떤 축제나 행사의 요금을 말씀하시는지 행사 이름을 알려주세요.'
  }

  return '현재 LLM 연결을 사용할 수 없어 일반 대화에 답하지 못했습니다. OPENAI_API_KEY와 OPENAI_MODEL 설정을 확인해 주세요.'
}

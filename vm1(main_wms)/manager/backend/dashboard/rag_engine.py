import faiss
import numpy as np
import torch
from transformers import BertTokenizer, BertModel
from openai import OpenAI
import re

# OpenAI API 클라이언트 초기화
client = OpenAI(api_key="키입력")

# =========================
# 설정
# =========================
EMBEDDING_DIM = 768
TOP_K = 5  # 검색할 문단 개수
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# BERT 모델과 토크나이저 로드
tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
model = BertModel.from_pretrained('bert-base-uncased').to(DEVICE)
model.eval()

# FAISS 인덱스와 저장된 데이터 로드
index = faiss.read_index("document_faiss_index.idx")
document_titles = np.load("document_titles.npy", allow_pickle=True)
paragraph_texts = np.load("paragraph_texts.npy", allow_pickle=True)

# =========================
# 유저 질문 임베딩 함수
# =========================
def embed_query(query):
    inputs = tokenizer(query, return_tensors='pt', truncation=True, padding=True, max_length=512)
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model(**inputs)
    query_embedding = outputs.last_hidden_state[:, 0, :].cpu().numpy()
    return query_embedding

# =========================
# 문단 검색 함수
# =========================
def search_documents(query):
    query_vec = embed_query(query)
    distances, indices = index.search(query_vec, TOP_K)
    indices = indices.flatten()
    retrieved_paragraphs = [paragraph_texts[i] for i in indices]
    return retrieved_paragraphs

# =========================
# GPT 답변 포맷팅 함수
# =========================
def format_pretty_answer(raw_text):
    """
    GPT RAG 답변을 보기 좋게 HTML 스타일로 포맷팅하는 함수
    - 문단 구분: <br><br>
    - 추천 슬롯 강조: 빨간색
    - 제목 강조: <b>📌 제목</b>
    """
    import re

    # 1. 줄바꿈 통일
    raw_text = re.sub(r'\n+', '\n', raw_text.strip())

    # 2. 문장 단위 분리
    lines = raw_text.split("\n")
    formatted_lines = []

    title_pattern = re.compile(r'^(###|##)?\s?[\d]+\.\s+.*')  # 1. ~ 형태
    subtitle_pattern = re.compile(r'^\*\*.*\*\*$')            # **소제목**
    slot_pattern = re.compile(r'(SLOT-\d-\d-\d)')           # SLOT 강조

    for line in lines:
        line = line.strip()
        if not line:
            formatted_lines.append("<br>")  # 문단 간격용
            continue

        # 제목
        if title_pattern.match(line):
            clean = re.sub(r'(###|##|\*\*)', '', line).strip()
            formatted_lines.append(f"<br><b>📌 {clean}</b><br>")
        # 소제목
        elif subtitle_pattern.match(line):
            clean = line.replace("**", "")
            formatted_lines.append(f"<b>{clean}</b>")
        # 일반 문장/리스트
        else:
            # 추천 슬롯 하이라이트
            line = slot_pattern.sub(
                lambda m: f'<span style="color:red; font-weight:bold;">{m.group(0)}</span>',
                line
            )
            # 리스트 유지
            if line.startswith("- "):
                formatted_lines.append(f"{line}")
            else:
                formatted_lines.append(f"{line}")

    # 최종 HTML 정리
    html_answer = "<br>".join(formatted_lines)
    html_answer = re.sub(r'(<br>){3,}', '<br><br>', html_answer)  # 문단 구분 이중 줄바꿈

    return html_answer.strip()

# =========================
# GPT로 최종 답변 생성 함수
# =========================
def generate_rag_answer(user_query):
    retrieved_paragraphs = search_documents(user_query)
    prompt = f"""
        당신은 WMS 시스템과 관련된 정보를 안내하는 전문 챗봇입니다.
        아래는 참고할 수 있는 관련 문단입니다:
        다음 문서를 참고해서 사용자의 질문에 답변해줘.
        {retrieved_paragraphs}

        🔥 답변 작성 지침:
        - 친절하고 정리된 답변을 작성하세요.
        - 주요 항목이 바뀔 때마다 **\\n\\n** (줄바꿈 두 번)을 삽입하세요.
        - 리스트가 필요한 경우 **반드시 - (하이픈)** 으로 시작해서 리스트 형태로 작성하세요. (예: "- 소형: 8개 적재")
        - 리스트 하이픈(-) 누락 금지
        - 불필요한 말은 넣지 말고 질문에 집중하세요.
        (줄바꿈 느낌만 내지 말고, 실제로 '\\n\\n' 줄바꿈 2개를 삽입하세요!)
        
        위 문단을 참고해서 사용자의 질문에 정확하고 친절하게 답변해 주세요. 답변은 포맷팅을 고려해서 친절하고 보기 좋게 작성해
        사용자 질문: "{user_query}"
        답변:
        """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "너는 WMS 시스템 관련 전문 안내 챗봇이야."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=1500
        )
        answer = response.choices[0].message.content.strip()
        pretty_answer = format_pretty_answer(answer)
        return pretty_answer
    except Exception as e:
        print(f"[GPT 오류] {e}")
        return "답변 생성 중 오류가 발생했습니다."


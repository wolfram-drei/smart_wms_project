import os
import torch
import numpy as np
import faiss
from PyPDF2 import PdfReader
from transformers import BertTokenizer, BertModel

# =========================
# 설정
# =========================
pdf_folder = "./documents"  # PDF 파일들이 들어있는 폴더
embedding_dim = 768  # BERT 모델의 출력 차원
BATCH_SIZE = 16  # 배치 크기
min_pragraph_length = 30  # 문단 최소 길이 (30자 이상)
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# =========================
# BERT 모델 로드
# =========================
tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
model = BertModel.from_pretrained('bert-base-uncased').to(DEVICE)
model.eval()  # 평가 모드로 설정

# =========================
# PDF 텍스트 추출 함수
# =========================
def extract_text_from_pdf(pdf_path):
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

# =========================
# 문단들을 BERT 임베딩으로 변환하는 함수 (배치 처리)
# =========================
def embed_texts(text_list, batch_size=BATCH_SIZE):
    embeddings = []
    for i in range(0, len(text_list), batch_size):
        batch = text_list[i:i + batch_size]
        inputs = tokenizer(batch, return_tensors='pt', padding=True, truncation=True, max_length=512)
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = model(**inputs)
        batch_cls_embeddings = outputs.last_hidden_state[:, 0, :].cpu().numpy()
        embeddings.append(batch_cls_embeddings)
    embeddings = np.vstack(embeddings)
    return embeddings

# =========================
# PDF 파일 처리 시작
# =========================
pdf_files = [os.path.join(pdf_folder, file) for file in os.listdir(pdf_folder) if file.endswith('.pdf')]
# FAISS 인덱스 생성 (벡터 차원은 BERT의 출력 크기와 동일하게 설정)
index = faiss.IndexFlatL2(embedding_dim)
# 모든 PDF 파일에서 텍스트 추출 및 임베딩 생성 후 저장
document_titles = []
paragraph_texts = []

for pdf_file in pdf_files:
    text = extract_text_from_pdf(pdf_file)
    paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) > min_pragraph_length]
    if not paragraphs:
        continue  # 문단이 아예 없으면 스킵
    # 문단 임베딩 생성
    paragraph_embeddings = embed_texts(paragraphs)
    # FAISS 인덱스에 추가
    index.add(paragraph_embeddings)
    # 문단 및 제목 기록
    document_titles.extend([os.path.basename(pdf_file)] * len(paragraphs))
    paragraph_texts.extend(paragraphs)

# =========================
# 결과 저장
# =========================
faiss.write_index(index, "document_faiss_index.idx")
np.save("document_titles.npy", np.array(document_titles))
np.save("paragraph_texts.npy", np.array(paragraph_texts))
print("최적화된 FAISS 인덱스와 문단 및 제목 저장 완료")
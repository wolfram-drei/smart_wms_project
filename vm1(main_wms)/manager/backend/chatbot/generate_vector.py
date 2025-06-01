# generate_vector_faiss.py

from langchain.vectorstores import FAISS
from langchain.schema import Document
from langchain_openai import OpenAIEmbeddings
import os
from config import OPENAI_API_KEY

# OpenAI API 키 환경변수 설정
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

# 문서 로딩
with open("customer_description.txt", "r", encoding="utf-8") as f:
    lines = [line.strip() for line in f if line.strip()]
documents = [Document(page_content=line, metadata={"source": "manual"}) for line in lines]

# OpenAI 임베딩 생성
embedding = OpenAIEmbeddings()

# FAISS 벡터 저장소 생성
vectorstore = FAISS.from_documents(documents, embedding)

# 저장
vectorstore.save_local("faiss_store")

print(f"✅ FAISS 벡터 생성 완료! 문서 수: {len(documents)}")

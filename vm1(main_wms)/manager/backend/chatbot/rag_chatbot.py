from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
import os
from config import OPENAI_API_KEY
import re

# 환경변수로 OpenAI 키 설정
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

# Flask 앱 초기화
app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["http://34.64.211.3:3000", "http://34.64.211.3"])

# 임베딩 & 챗 모델 초기화
embedding = OpenAIEmbeddings()
chat = ChatOpenAI(model="gpt-3.5-turbo")  # 또는 gpt-4 사용 가능

# FAISS 벡터 DB 로드
vectorstore = FAISS.load_local("faiss_store", embedding, allow_dangerous_deserialization=True)

def auto_link(text):
    return re.sub(
        r"(https?://[^\s\)\]\}\>\"']+)",
        r'<a href="\1" target="_blank" rel="noopener noreferrer">\1</a>',
        text
    )

# RAG API 엔드포인트
@app.route("/api/admin/rag", methods=["POST"])
def rag_chat():
    data = request.json
    query = data.get("query", "")
    history = data.get("history", [])  # 이전 대화 내용(히스토리) 수신

    if not query:
        return jsonify({"error": "No query provided"}), 400

    # 유사 문서 검색
    docs = vectorstore.similarity_search(query, k=5)
    reference_context = "\n".join([doc.page_content for doc in docs])

    # 이전 대화 히스토리를 프롬프트에 포함
    history_text = ""
    for item in history:
        role = "사용자" if item["type"] == "question" else "AI"
        history_text += f"{role}: {item['text']}\n"

    prompt = (
        f"다음은 고객 지원 문서 내용입니다:\n{reference_context}\n\n"
        f"이전 대화 히스토리:\n{history_text}\n"
        f"사용자 질문: {query}\n"
        f"이 정보를 참고하여 정확하고 친절하게 답변해주세요. 고객 지원 문서 내용 이외에 관련 없는 질문에 대해서는 '해당 정보는 고객 지원 문서에서 찾을 수 없습니다.' 라고 대답해주세요."
        f"만약 문서에 URL 정보가 있다면 하이퍼링크 형식으로 URL 링크를 보여주세요."
    )

    # 생성형 응답
    response = chat.predict(prompt)
    response_with_links = auto_link(response)
    return jsonify({
        "answer": response_with_links,
        "references": [d.page_content for d in docs]
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5081)

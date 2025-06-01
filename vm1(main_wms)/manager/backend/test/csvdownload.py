import pandas as pd
from google.cloud import storage
import io
import os

# ✅ GCS 설정
bucket_name = 'member07'  # 버킷 이름
prefix = 'member07/member07/member07-'  # GCS 경로 (파일 접두사)

# ✅ 내 다운로드 폴더 경로에 저장
download_dir = os.path.expanduser('~/Downloads')
merged_csv_path = os.path.join(download_dir, 'member07_merged_utf8.csv')

# ✅ GCS 연결
client = storage.Client()
bucket = client.bucket(bucket_name)

dfs = []

# ✅ 50개의 CSV 파일 반복 다운로드 + 병합
for i in range(50):
    blob_name = f"{prefix}{str(i).zfill(12)}.csv"
    blob = bucket.blob(blob_name)

    if not blob.exists():
        print(f"❌ 파일 없음: {blob_name}")
        continue

    print(f"📥 병합 중: {blob_name}")
    content = blob.download_as_bytes()
    df = pd.read_csv(io.BytesIO(content))
    dfs.append(df)

# ✅ 최종 병합 및 저장 (한글 깨짐 방지 인코딩)
final_df = pd.concat(dfs, ignore_index=True)
final_df.to_csv(merged_csv_path, index=False, encoding='utf-8-sig')

print(f"✅ 저장 완료: {merged_csv_path}")

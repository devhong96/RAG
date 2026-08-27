# 문제 해결 (Troubleshooting)

---

## 1. `Database error: unable to open database file`

* **현상**: `npm run lec:07-08` 실행 시 heartbeat는 정상인데 컬렉션을 열 때 SQLite 데이터베이스 에러가 발생하는 경우
* **원인**: 이전에 다른 폴더에서 실행된 Chroma 프로세스가 포트 8000을 잡고 있어 실제 DB 파일을 열지 못하는 현상
* **해결 방법**:
  ```bash
  # 1. 실행 중인 이전 Chroma 프로세스 종료
  pkill -f "chroma run"

  # 2. 프로젝트 루트 폴더에서 Chroma 재실행
  npm run db
  ```

---

## 2. 데이터 전체 초기화

* **컬렉션만 초기화할 때**:
  ```bash
  npm run reset
  ```
* **물리 DB 파일까지 완전 삭제 후 새로 시작할 때**:
  ```bash
  # Chroma 서버 종료(Ctrl+C) 후 실행
  rm -rf chroma-data
  ```

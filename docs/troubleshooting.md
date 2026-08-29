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

---

## 3. `Cannot find module 'sharp'` (OCR 실행 시)

* **현상**: `npm run ocr:parse` 또는 `npm run ocr:search` 실행 시 `sharp` 모듈을 찾을 수 없다는 에러가 발생하는 경우
* **원인**: `src/ocr/` 코드는 이미지 전처리에 `sharp` 를 직접 사용한다.
  예전에는 `package.json` 에 `sharp` 가 선언되어 있지 않았고, `@xenova/transformers` 가
  내부적으로 끌어온 `sharp` 를 우연히 빌려 쓰고 있었다 (이런 것을 **유령 의존성**이라고 부른다).

  > **초보자 설명**: npm 은 설치한 패키지들이 각자 필요로 하는 패키지까지 `node_modules` 에 함께 풀어놓는다.
  > 그래서 내가 설치한 적 없는 패키지도 `import` 가 우연히 성공할 때가 있다.
  > 하지만 이건 "다른 패키지가 마침 그것을 필요로 했기 때문"일 뿐이라,
  > 그 패키지를 지우거나 버전을 올리는 순간, 혹은 다른 PC 에서 `npm ci` 로 새로 설치하는 순간
  > 갑자기 사라진다. 직접 `import` 하는 패키지는 **반드시** `package.json` 에 선언해야 한다.

* **해결 방법**:
  ```bash
  npm install sharp
  ```
  (현재는 `package.json` 의 `dependencies` 에 `sharp` 가 선언되어 있으므로
  `npm install` 만 실행하면 함께 설치된다.)

# Beads MCP (TypeScript)

이 레포는 [`beads`](https://github.com/steveyegge/beads) 이슈 트래커/에이전트 메모리 시스템과 연동되는
Model Context Protocol (MCP) 서버의 TypeScript 구현입니다.

Python 기반 `beads-mcp`가 하는 것처럼, 이 서버는 `bd` CLI를 호출해서 실제 이슈를 관리합니다.
로컬 JSON 파일을 직접 다루지 않고, 항상 beads 데이터베이스를 사용합니다.

## Tools

공식 Python `beads-mcp` README와 동일한 MCP tool 이름/역할을 제공합니다.
모든 tool 은 선택적인 `workspace_root` 파라미터를 지원합니다.

- `set_context` – 이후 모든 호출에 사용할 기본 `workspace_root` 설정
- `where_am_i` – 현재 컨텍스트와 데이터베이스 경로 표시
- `ready` – blocker 가 없는, 바로 작업 가능한 이슈 조회
- `list` – 상태/우선순위/타입/담당자 필터로 이슈 목록 조회
- `show` – 단일 이슈 상세 정보 (dependencies 포함)
- `create` – 새 이슈 생성 (bug/feature/task/epic/chore, deps 등)
- `update` – 기존 이슈 갱신  
  - `status="closed"` → 내부적으로 `close` tool 호출  
  - `status="open"` → 내부적으로 `reopen` tool 호출
- `close` – 이슈 종료 (`reason` 포함)
- `reopen` – 하나 이상 이슈 재개
- `dep` – 이슈 사이 의존성 추가  
  (`blocks`, `related`, `parent-child`, `discovered-from`)
- `stats` – 전체/상태별/blocked/ready/리드타임 통계
- `blocked` – blocking dependency 가 있는 이슈 목록
- `init` – 현재 디렉터리에 `.beads/` 및 DB 초기화 (prefix 옵션)
- `debug_env` – 워킹 디렉터리/환경변수 디버그 출력
- `inspect_migration` – 마이그레이션 플랜 및 DB 상태 조회
- `get_schema_info` – 현재 DB 스키마 정보
- `repair_deps` – 고아 의존성 탐지 및 선택적 자동 수정
- `detect_pollution` – 테스트 이슈가 프로덕션 DB로 섞인 것 탐지/정리
- `validate` – orphans/duplicates/pollution/conflicts 등 종합 건강검사

### Resource

- `beads://quickstart` – `bd quickstart` 내용을 그대로 반환하는 퀵스타트 가이드

## Usage

1.  Build the project:
    ```bash
    npm install
    npm run build
    ```

2.  MCP 클라이언트(예: Claude Desktop, Cursor)에서 이 서버를 사용하도록 설정합니다.
    - Command: `node`
    - Args: `[path-to-this-repo]/build/index.js`

## Environment Variables

공식 `beads-mcp` README 와 동일한 환경 변수를 지원합니다. (모두 선택 사항)

- `BEADS_USE_DAEMON` – 현재 구현은 CLI 기반이므로 값에 관계없이 CLI 를 사용합니다.
- `BEADS_PATH` – `bd` 실행 파일 경로  
  - 기본값: PATH 에서 `bd` 검색, 없으면 `~/.local/bin/bd`
- `BEADS_DB` – beads 데이터베이스 파일 경로 (필요 시 CLI 에 전달)
- `BEADS_WORKING_DIR` – `bd` 명령이 실행될 기본 워킹 디렉터리  
  - `set_context` tool 을 호출하면 이 값이 설정/업데이트 됩니다.
- `BEADS_ACTOR` – 감사 로그용 actor 이름 (기본: `$USER`)
- `BEADS_NO_AUTO_FLUSH` – `true`/`1` 시 JSONL 자동 flush 비활성화
- `BEADS_NO_AUTO_IMPORT` – `true`/`1` 시 JSONL 자동 import 비활성화
- `BEADS_REQUIRE_CONTEXT` – `1` 이면 write 계열 tool 은 `workspace_root` 나 `set_context` 가 필수

## Workspace & Multi-Repo

- 기본적으로 MCP 프로세스의 `cwd`를 워킹 디렉터리로 사용합니다.
- `set_context(workspace_root=...)` 를 호출하면:
  - git repo 루트(가능한 경우)로 정규화
  - `BEADS_WORKING_DIR`, `BEADS_DB`를 설정
  - 이후 모든 tool 은 `workspace_root` 파라미터가 없으면 이 값을 사용
- `ready`, `list`, `show`, `create`, `update`, `close`, `reopen`, `dep`, `stats`, `blocked` 등
  모든 tool 의 `workspace_root` 파라미터로 프로젝트를 명시적으로 지정할 수 있습니다.

## Data Storage (bd CLI)

실제 데이터는 항상 `bd` CLI 가 관리합니다.

- `.beads/` 디렉터리 및 DB 파일은 `bd` 가 워킹 디렉터리 기준으로 자동 탐색합니다.
- `init` tool 은 내부적으로 `bd init` 을 호출해서 새 데이터베이스를 만듭니다.


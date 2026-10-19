# grokbot-relay

Claude Code, Cursor, 터미널에서 내 Grok Bot 에이전트에게 **로컬** Cursor BDK 중계(`cursor-grokbot-agents` 확장)로 질문하고 답을 받아옵니다. [English](README.md)

> 0.1.0: `@cursor/bdk` 0.2.25 문서 기준 뼈대입니다. **로컬 확인 필요** 표시는 아직 테스트하지 않았습니다.

> 사용 규칙 스킬(Claude Code 플러그인)은 [devicki/dev-toolkit](https://github.com/devicki/dev-toolkit/tree/main/plugins/grokbot-relay)에 있습니다. 이 저장소는 중계 서버입니다.

## 구조

```
Claude Code / Cursor ──stdio──> bdk mcp ──HTTP(127.0.0.1)──> bdk serve(relay/) ──> 내 Grok Bot 에이전트
```

- 허용 목록: 서버에만 두고 git에는 넣지 않습니다. `GROKBOT_RELAY_AGENTS`(쉼표로 구분한 이름) 또는 `/etc/grokbot-relay/agents.json`(형식: [`agents.example.json`](agents.example.json), 다른 경로는 `GROKBOT_RELAY_AGENTS_FILE`). 올바른 설정이 없으면 중계가 시작을 거부합니다. 빈 목록은 원래 아무 이름이나 허용하기 때문입니다. 이름은 Grok Bot 앱에 보이는 그대로 적으세요. 오타가 나면 빈 봇이 새로 생길 수 있습니다. `grokbot__interrupt`는 `tools/interrupt.ts`로 껐습니다.
- 인증은 이 컴퓨터의 내 Cursor 로그인입니다. 저장소에는 아무 키도 없습니다.

## 설치 (로컬)

로컬(서비스 아님) 실행은 PATH에 Node.js 22+가 필요합니다. 아래 서버 설치는 자체 Node를 씁니다.

```bash
cd relay
npm install
npx bdk login                     # 브라우저에서 내 Cursor 계정 로그인
export GROKBOT_RELAY_AGENTS="Feedhand,Research Bot"   # 내 봇 이름, 앱에 보이는 그대로
npx bdk validate
npx bdk dev                       # 선택: playground에서 "누구랑 얘기할 수 있어?" 시험

export GROKBOT_RELAY_TOKEN="$(openssl rand -hex 32)"   # git에 넣지 마세요
npx bdk serve --dir . --port 47800 --bearer-token "$GROKBOT_RELAY_TOKEN"
```

**로컬 확인 필요**
- `bdk serve`가 출력하는 포트와 주소, MCP 경로가 `/v1/mcp`인지 `/<slug>/v1/mcp`인지
- `serve`가 `--bearer-token`을 받는지(CLI 도움말엔 serve용으로 나옴), 127.0.0.1에서만 열리는지

### Cursor

```bash
npx bdk mcp install --url http://127.0.0.1:47800 --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot --print   # 미리보기
npx bdk mcp install --url http://127.0.0.1:47800 --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot
```

토큰이 `~/.cursor/mcp.json`에 저장됩니다. 이 파일은 비밀번호처럼 다루세요.

### Claude Code

```bash
export GROKBOT_RELAY_PORT=47800
claude mcp add grokbot -- npx -y @cursor/bdk mcp --url "http://127.0.0.1:$GROKBOT_RELAY_PORT" --bearer-token "$GROKBOT_RELAY_TOKEN"
```

또는 `.mcp.json.example`을 프로젝트의 `.mcp.json`으로 복사하세요. 포트와 토큰은 환경변수에서 읽습니다. 사용 규칙 스킬은 플러그인으로 설치합니다.

```bash
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

## 서버 배포 (Linux, systemd)

서버 1대, 서비스 계정 `grokbot` 1개, 사용자 여러 명 구조입니다. 관리자(root)가 설치하고, `grokbot` 그룹에 들어간 일반 사용자가 연결합니다.

| 경로 | 내용 |
| --- | --- |
| `/opt/grokbot-relay/relay` | 중계 앱 (소유자 `grokbot`) |
| `/var/lib/grokbot` | `grokbot` 홈: Cursor 로그인 정보, serve 상태 |
| `/etc/grokbot-relay/agents.json` | 봇 이름 허용 목록 (640 root:grokbot, git에 없음) |
| `/etc/grokbot-relay/env` | `GROKBOT_RELAY_PORT`, `GROKBOT_RELAY_TOKEN` (640 root:grokbot) |

- 기본 포트: **47800** (흔히 쓰지 않고, 알려진 서비스 포트가 아님). `install`이 `ss -ltn`으로 확인해서 이미 쓰이면 다음 빈 포트를 씁니다(마법사는 미리 채워 보여 줌). 이미 설정된 포트는 update/재설치 때 그대로 둡니다.

관리자(root):

```bash
git clone https://github.com/devicki/grokbot-relay && cd grokbot-relay
sudo ./bin/grokbot-relay install --tui    # 마법사. 비대화식: install [--port N]
sudo grokbot-relay agents add "Feedhand"  # 내 봇 이름, 앱에 보이는 그대로 (또는 agents edit)
sudo grokbot-relay agents remove "Research Bot"   # 예시 이름 빼기
sudo grokbot-relay login                  # grokbot 계정으로 Cursor 로그인
sudo grokbot-relay start
sudo grokbot-relay doctor
sudo usermod -aG grokbot <사용자1>
sudo usermod -aG grokbot <사용자2>
```

나중에 업데이트:

```bash
sudo grokbot-relay update                 # 기록된 clone에서 git pull, 다시 복사, npm ci, 재시작. 이전 → 새 버전 표시
sudo grokbot-relay bdk-check              # 새 @cursor/bdk가 나왔는지
sudo grokbot-relay bdk-upgrade            # 올리고 validate, 통과하면 재시작, 실패하면 되돌림
```

일반 사용자 각자 (`usermod` 후 다시 로그인):

```bash
id                                        # grokbot 그룹이 보이는지
grokbot-relay connect-claude              # MCP 서버 "grokbot" 등록 (user 범위)
claude mcp list
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

### Node 런타임

중계는 **자체 Node 24**를 `/opt/grokbot-relay/node`에 둡니다. `install`이 nodejs.org에서 공식 linux tarball(x64/arm64)을 받아 `SHASUMS256.txt`로 검증하고 풉니다. **전역 PATH에는 절대 넣지 않으므로** 다른 계정의 Node(nvm 등)에 영향이 없습니다. CLI와 systemd 유닛(`Environment=PATH=/opt/grokbot-relay/node/bin:/usr/bin:/bin`)만 이 런타임을 씁니다. 설치에는 `curl`, `tar`, `sha256sum`만 있으면 됩니다.

- `sudo grokbot-relay node-upgrade`: 최신 24.x로 교체 (`bdk validate` 실패 시 되돌림). `update`는 런타임을 유지합니다.
- `install --node system`: 이미 있는 시스템 node 22+를 사용.
- `connect-claude`는 `/opt/grokbot-relay/node/bin/node`와 `/opt/grokbot-relay/relay`에 설치된 `bdk`를 등록합니다. 그래서 일반 사용자는 중계용 Node가 따로 필요 없습니다(`grokbot` 그룹에 읽기·실행 권한).

## TUI

터미널에서 `sudo grokbot-relay`를 인자 없이 실행하면 메뉴가 열립니다.

![메인 메뉴](https://raw.githubusercontent.com/devicki/grokbot-relay/main/docs/tui-main.png)

- [gum](https://github.com/charmbracelet/gum)으로 만들었습니다. `install`이 gum 공식 릴리스(x64/arm64)를 받아 `checksums.txt`로 검증하고 `/opt/grokbot-relay/bin/gum`에 둡니다. Node 런타임처럼 전역 PATH에는 넣지 않습니다. 받기에 실패하면 whiptail이나 번호 메뉴로 동작합니다.
- 어두운 네온 스타일: 보라·청록 강조색, 둥근 테두리, 상태 헤더(`● online · 포트 · 봇 수 · 버전`). 오래 걸리는 단계는 스피너를 보여 주고, 마법사는 `[n/8]`과 진행 막대를 보여 줍니다.
- 처음 실행(설치 전)에는 **설치 마법사**를 권합니다: 환영 → Node 런타임 → 설치 → Cursor 로그인(링크 표시) → 봇 선택(현재 이름이 미리 체크된 다중 선택 + 직접 입력, 빈 목록 불가) → 시작 → doctor → 그룹 사용자. `sudo grokbot-relay install --tui`로 바로 열 수 있습니다.
- 메인 메뉴: 상태 · 시작/중지/재시작/로그 · 봇 · Cursor 로그인 · Doctor · 업데이트 · Cursor BDK/Node 런타임 · 설치 마법사 · Claude Code 연결 · 정보 · 삭제(`YES` 입력).
- `grokbot-relay --plain` 또는 `NO_COLOR=1`은 색 없는 번호 메뉴를 씁니다. 모든 하위 명령은 대화창 없이 그대로 동작합니다.
- 위저드 키: **Esc** = 이전 단계 (1단계에서는 종료 확인) · **Ctrl+C** = 확인 후 종료 (다음 단계로 넘어가지 않음). plain 모드는 `b` 뒤로, `q` 종료. 다시 이어서 하려면 `sudo grokbot-relay install --tui`를 실행하세요.
- 메뉴 항목 추가는 `bin/lib/tui.sh`에 한 줄(`MAIN_MENU`, `WIZARD_STEPS` 등에 `"id|label|function"`)이면 됩니다.

## CLI

`install`이 `/usr/local/bin/grokbot-relay`를 `/opt/grokbot-relay/bin`의 사본으로 연결합니다. `update`에 쓰려고 원본 clone 경로를 `/etc/grokbot-relay/source`에 기록합니다. 토큰은 어떤 명령도 출력하지 않습니다.

| 명령 | root | 내용 |
|---|---|---|
| `install [--port N] [--node private\|system] [--tui]` | 필요 | 계정, `/opt` 앱, `npm ci`, env(토큰은 처음 한 번만 생성), `agents.json`(없으면 예시로 생성), systemd 유닛 enable (시작은 안 함) |
| `login` | 필요 | grokbot 계정으로 `bdk login` |
| `start`, `stop`, `restart` | 필요 | 서비스 제어 |
| `status`, `logs [-f]` | 불필요 | `systemctl status`, `journalctl` |
| `enable`, `disable` | 필요 | 부팅 시 자동 시작 켜기·끄기 |
| `update` | 필요 | 원본 clone에서 `git pull --ff-only`, 다시 복사, `npm ci`, 재시작. env와 `agents.json`은 유지 |
| `node-upgrade` | 필요 | 자체 Node 런타임을 최신 24.x로 교체 |
| `bdk-check` | 불필요 | 설치된 `@cursor/bdk`와 npm 최신 버전 비교, 링크 표시 |
| `bdk-upgrade [--pin]` | 필요 | `/opt`에서 `npm install @cursor/bdk@latest`, `bdk validate` 통과 시에만 재시작, 실패하면 되돌림. `--pin`은 원본 clone의 `relay/package*.json`도 바꿔 PR을 올릴 수 있게 함 |
| `agents list` | 그룹 | 허용된 이름 |
| `agents pick` | 필요 | 현재 이름(미리 체크)의 다중 선택 + 직접 입력. Grok Bot 계정의 봇 목록은 **가져올 수 없습니다**: @cursor/bdk에 목록 조회 경로가 없어서, 아직 넣지 않은 이름은 직접 입력해야 합니다. 터미널에서 이름 없이 `agents add`를 실행하면 같은 선택 화면이 열립니다 |
| `agents add NAME`, `agents remove NAME`, `agents edit` | 필요 | `agents.json` 수정 후 재시작. 빈 목록은 거부 |
| `doctor` | root 권장 | node, 파일과 권한, 서비스, 127.0.0.1 포트, 로그인(`bdk whoami`), bdk 버전 |
| `connect-claude [--scope user\|local]` | 불필요 (grokbot 그룹) | Claude Code에 중계 등록 |
| (인자 없음), `tui` | | 터미널 메뉴 |
| `uninstall [--purge\|--keep-config] [-y]` | 필요 | 중계 삭제, 아래 참고 |
| `version`, `help` | 불필요 | |

참고:
- `connect-claude`는 시작할 때마다 `/etc/grokbot-relay/env`를 읽는 `bash -c` 명령을 등록합니다. 그래서 토큰이 Claude Code 설정(`~/.claude.json`)에 **저장되지 않습니다**. 토큰을 직접 넣어 `claude mcp add`를 하면 거기에 평문으로 저장됩니다.
- 토큰은 프로세스 인자(`--bearer-token`)로 넘어가서 같은 서버의 다른 사용자가 `ps`로 볼 수 있습니다. 공용 서버라면 `/proc`를 `hidepid=2`로 마운트하세요.
- `grokbot` 그룹 사용자는 토큰 하나를 같이 써서 BDK 호출자 신원(연락 목록, 읽은 위치)과 Grok Bot 계정을 공유합니다.
- 토큰 교체: env 파일 수정 후 `sudo grokbot-relay restart`. 사용자는 다시 할 일이 없습니다.

**서버에서 확인 필요**
- 유닛의 `bdk serve` 옵션: `--host 127.0.0.1 --port`, `--mode single`(MCP 경로 `/v1/mcp`), `--bearer-token` (0.2.25 CLI 문서 기준, 아직 실행 안 함)
- `doctor`의 로그인 확인(`bdk whoami`)이 동작하는지, `/var/lib/grokbot` 아래 CLI 설정에 저장되는 `bdk login` 정보가 재부팅 후에도 남고, 하드닝된 유닛에서도 읽히는지
- 화면 없는 서버에서 `bdk login`이 로그인 링크를 출력해 다른 브라우저로 열 수 있는지

### 삭제

```bash
sudo grokbot-relay uninstall                # 지울 목록 표시 → 진행 확인 → 설정·로그인·계정은 하나씩 물어봄
sudo grokbot-relay uninstall --keep-config  # /etc/grokbot-relay(토큰, agents.json) 유지
sudo grokbot-relay uninstall --purge -y     # 전부 삭제, 묻지 않음
```

서비스 유닛, `/opt/grokbot-relay`, `/usr/local/bin/grokbot-relay`, `/etc/grokbot-relay/source`는 항상 지웁니다. 원본 clone은 건드리지 않습니다. TUI 메뉴(삭제, `YES` 입력으로 확인)에서도 할 수 있습니다.

## 안전

- `serve`는 루프백에서만 여세요. 밖으로 열려면 인증 프록시를 앞에 두세요.
- `check`는 봇 대화를 읽습니다. 중계에 접근할 수 있는 사람은 답을 읽을 수 있습니다.
- 모든 호출자가 Grok Bot 계정 하나와 봇 기억을 같이 씁니다.
- **Feedhand는 요청만 받습니다.** 게시는 Feedhand 채팅에서 내가 승인해야 나갑니다. 중계로는 절대 승인하지 않습니다.
- `bdk mcp`는 `--prod` 클라우드 배포에서 동작하지 않습니다. 로컬에서 실행하세요.

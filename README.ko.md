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

Node.js 22 이상이 필요합니다.

```bash
cd relay
npm install
npx bdk login                     # 브라우저에서 내 Cursor 계정 로그인
export GROKBOT_RELAY_AGENTS="Feedhand,Research Bot"   # 내 봇 이름, 앱에 보이는 그대로
npx bdk validate
npx bdk dev                       # 선택: playground에서 "누구랑 얘기할 수 있어?" 시험

export GROKBOT_RELAY_TOKEN="$(openssl rand -hex 32)"   # git에 넣지 마세요
npx bdk serve --dir . --bearer-token "$GROKBOT_RELAY_TOKEN"
```

**로컬 확인 필요**
- `bdk serve`가 출력하는 포트와 주소, MCP 경로가 `/v1/mcp`인지 `/<slug>/v1/mcp`인지
- `serve`가 `--bearer-token`을 받는지(CLI 도움말엔 serve용으로 나옴), 127.0.0.1에서만 열리는지

### Cursor

```bash
npx bdk mcp install --url http://127.0.0.1:<PORT> --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot --print   # 미리보기
npx bdk mcp install --url http://127.0.0.1:<PORT> --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot
```

토큰이 `~/.cursor/mcp.json`에 저장됩니다. 이 파일은 비밀번호처럼 다루세요.

### Claude Code

```bash
export GROKBOT_RELAY_PORT=<PORT>
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

관리자(root):

```bash
git clone https://github.com/devicki/grokbot-relay && cd grokbot-relay
sudo ./deploy/install.sh            # 선택: --port 3000
sudo nano /etc/grokbot-relay/agents.json   # 내 봇 이름 적기 (agents.example.json으로 생성됨)
sudo -u grokbot -H bash -c 'cd /opt/grokbot-relay/relay && npx bdk login'
sudo systemctl start grokbot-relay
sudo systemctl status grokbot-relay --no-pager
sudo usermod -aG grokbot <사용자1>
sudo usermod -aG grokbot <사용자2>
```

일반 사용자 각자 (`usermod` 후 다시 로그인):

```bash
git clone https://github.com/devicki/grokbot-relay && cd grokbot-relay
./deploy/connect-claude.sh          # MCP 서버 "grokbot" 등록 (user 범위)
claude mcp list
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

참고:
- `connect-claude.sh`는 시작할 때마다 `/etc/grokbot-relay/env`를 읽는 `bash -c` 명령을 등록합니다. 그래서 토큰이 Claude Code 설정(`~/.claude.json`)에 **저장되지 않습니다**. 토큰을 직접 넣어 `claude mcp add`를 하면 거기에 평문으로 저장됩니다.
- 토큰은 프로세스 인자(`--bearer-token`)로 넘어가서 같은 서버의 다른 사용자가 `ps`로 볼 수 있습니다. 공용 서버라면 `/proc`를 `hidepid=2`로 마운트하세요.
- `grokbot` 그룹 사용자는 토큰 하나를 같이 써서 BDK 호출자 신원(연락 목록, 읽은 위치)과 Grok Bot 계정을 공유합니다.
- 토큰 교체: env 파일 수정 후 `sudo systemctl restart grokbot-relay`. 사용자는 다시 할 일이 없습니다.

**서버에서 확인 필요**
- 유닛의 `bdk serve` 옵션: `--host 127.0.0.1 --port`, `--mode single`(MCP 경로 `/v1/mcp`), `--bearer-token` (0.2.25 CLI 문서 기준, 아직 실행 안 함)
- `/var/lib/grokbot` 아래 CLI 설정에 저장되는 `bdk login` 정보가 재부팅 후에도 남고, 하드닝된 유닛에서도 읽히는지
- 화면 없는 서버에서 `bdk login`이 로그인 링크를 출력해 다른 브라우저로 열 수 있는지

## 안전

- `serve`는 루프백에서만 여세요. 밖으로 열려면 인증 프록시를 앞에 두세요.
- `check`는 봇 대화를 읽습니다. 중계에 접근할 수 있는 사람은 답을 읽을 수 있습니다.
- 모든 호출자가 Grok Bot 계정 하나와 봇 기억을 같이 씁니다.
- **Feedhand는 요청만 받습니다.** 게시는 Feedhand 채팅에서 내가 승인해야 나갑니다. 중계로는 절대 승인하지 않습니다.
- `bdk mcp`는 `--prod` 클라우드 배포에서 동작하지 않습니다. 로컬에서 실행하세요.

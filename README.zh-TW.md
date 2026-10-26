# grokbot-relay

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [繁體中文](README.zh-TW.md)

透過**本機**的 Cursor BDK 中繼（`cursor-grokbot-agents` 擴充），從 Claude Code、Cursor 或終端機向你自己的 Grok Bot 代理提問並取得回覆。

> 狀態 0.1.0：依 `@cursor/bdk` 0.2.25 文件檢查過的骨架。標示 **需在本機驗證** 的項目尚未測試。

> 使用技能（Claude Code 外掛）位於 [devicki/dev-toolkit](https://github.com/devicki/dev-toolkit/tree/main/plugins/grokbot-relay)。本儲存庫是中繼伺服器。

## 運作方式

```
Claude Code / Cursor ──stdio──> bdk mcp ──HTTP (127.0.0.1)──> bdk serve (relay/) ──> 你的 Grok Bot 代理
```

- 允許清單：只放在伺服器本機，絕不進 git。`GROKBOT_RELAY_AGENTS`（以逗號分隔的名稱）或 `/etc/grokbot-relay/agents.json`（格式：[`agents.example.json`](agents.example.json)；其他路徑用 `GROKBOT_RELAY_AGENTS_FILE`）。若沒有有效設定，中繼會拒絕啟動，因為空清單會允許任何名稱。名稱請完全照 Grok Bot App 中顯示的複製；打錯字可能會建立一個新的空白機器人。`grokbot__interrupt` 已由 `tools/interrupt.ts` 移除。
- 驗證使用你在這台電腦上的 Cursor 登入。本儲存庫不儲存任何東西。

## 安裝（本機）

本機（非服務）使用需要 PATH 中有 Node.js 22+；下方的伺服器安裝會自帶 Node。

```bash
cd relay
npm install
npx bdk login                     # 在瀏覽器中登入你的 Cursor 帳號
export GROKBOT_RELAY_AGENTS="Feedhand,Research Bot"   # 你的機器人名稱，與 App 中完全相同
npx bdk validate
npx bdk dev                       # 選用：在 playground 試試「你可以跟誰對話？」

export GROKBOT_RELAY_TOKEN="$(openssl rand -hex 32)"   # 不要放進 git
npx bdk serve --dir . --port 47800 --bearer-token "$GROKBOT_RELAY_TOKEN"
```

**需在本機驗證**
- `bdk serve` 印出的連接埠與基礎 URL，以及 MCP 路徑是 `/v1/mcp` 還是 `/<slug>/v1/mcp`；
- `serve` 是否接受 `--bearer-token`（CLI 說明中列在 serve 底下），以及是否只監聽 127.0.0.1。

### Cursor

```bash
npx bdk mcp install --url http://127.0.0.1:47800 --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot --print   # 預覽
npx bdk mcp install --url http://127.0.0.1:47800 --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot
```

這會把權杖寫入 `~/.cursor/mcp.json`。請把該檔案當作憑證看待。

### Claude Code

```bash
export GROKBOT_RELAY_PORT=47800
claude mcp add grokbot -- npx -y @cursor/bdk mcp --url "http://127.0.0.1:$GROKBOT_RELAY_PORT" --bearer-token "$GROKBOT_RELAY_TOKEN"
```

或把 `.mcp.json.example` 複製為專案的 `.mcp.json`；它會從環境變數讀取 `GROKBOT_RELAY_PORT` 與 `GROKBOT_RELAY_TOKEN`。接著安裝此外掛以取得 `grokbot-relay` 技能：

```bash
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

## 伺服器部署（Linux、systemd）

一台伺服器、一個服務帳號 `grokbot`、多位使用者。由管理員（root）安裝；`grokbot` 群組中的一般使用者連線使用。

| 路徑 | 內容 |
| --- | --- |
| `/opt/grokbot-relay/relay` | 中繼程式（擁有者 `grokbot`） |
| `/var/lib/grokbot` | `grokbot` 家目錄：Cursor 登入 + serve 狀態 |
| `/etc/grokbot-relay/agents.json` | 機器人名稱允許清單（640 root:grokbot，不在 git 中） |
| `/etc/grokbot-relay/env` | `GROKBOT_RELAY_PORT`、`GROKBOT_RELAY_TOKEN`（640 root:grokbot） |

- 預設連接埠：**47800**（不常用，也不是知名服務連接埠）。`install` 會用 `ss -ltn` 檢查，若已被占用就改用下一個空閒連接埠（精靈會預先填入）。已設定的連接埠在更新／重新安裝時會保留。

管理員（root）：

```bash
git clone https://github.com/devicki/grokbot-relay && cd grokbot-relay
sudo ./bin/grokbot-relay install --tui    # 精靈；非互動式：install [--port N]
sudo grokbot-relay agents add "Feedhand"  # 你的機器人名稱，與 App 中完全相同（或：agents edit）
sudo grokbot-relay agents remove "Research Bot"   # 移除範例名稱
sudo grokbot-relay login                  # 以 grokbot 使用者登入 Cursor
sudo grokbot-relay start
sudo grokbot-relay doctor
sudo usermod -aG grokbot <user1>
sudo usermod -aG grokbot <user2>
```

日後更新：

```bash
sudo grokbot-relay update                 # 在記錄的 clone 中 git pull、重新複製、npm ci、重新啟動；顯示 舊 -> 新 版本
sudo grokbot-relay bdk-check              # 是否有更新的 @cursor/bdk？（v0 不會安裝超過 0.2.28）
sudo grokbot-relay bdk-upgrade            # 最多升到 0.2.28；更高的目標在 install 前拒絕
```

> 不要直接執行 `bdk update`；請使用 `grokbot-relay bdk-upgrade`（中繼使用 `/opt` 底下自己的 bdk）。

> 此版本將 `@cursor/bdk` 釘在正好 `0.2.28`。`bdk-upgrade` 會在 `npm install` 之前拒絕任何高於 `0.2.28` 的目標（`0.2.29` 之後會移除 `cursor-grokbot-agents` 擴充）。`relay-v1/` 的 v1 樹是 Agent SDK 0.3 的另一條線，不會改動這個釘選。見 [docs/spike-bdk-0.3.md](docs/spike-bdk-0.3.md)。

每位一般使用者（`usermod` 之後請登出再登入）：

```bash
id                                        # 是否列出 grokbot 群組？
grokbot-relay connect-claude              # 註冊 MCP 伺服器 "grokbot"（user 範圍）
claude mcp list
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

### Node 執行環境

中繼在 `/opt/grokbot-relay/node` 中自帶 **Node 24**：`install` 會從 nodejs.org 下載官方 linux tarball（x64/arm64），以 `SHASUMS256.txt` 驗證後解壓到該處。它**絕不會加入全域 PATH**，因此其他帳號的 Node（nvm 等）不受影響；只有 CLI 與 systemd unit（`Environment=PATH=/opt/grokbot-relay/node/bin:/usr/bin:/bin`）會使用它。安裝程式只需要 `curl`、`tar` 與 `sha256sum`。

- `sudo grokbot-relay node-upgrade` 會更新到最新的 24.x（若 `bdk validate` 失敗則回滾）。`update` 會保留它。
- `install --node system` 改用既有的系統 node 22+。
- `connect-claude` 會註冊 `/opt/grokbot-relay/node/bin/node` 以及 `/opt/grokbot-relay/relay` 中安裝的 `bdk`，因此一般使用者不需要為中繼自備 Node（`grokbot` 群組有讀取／執行權限）。

## TUI

在終端機執行 `sudo grokbot-relay`（不帶參數）即可開啟選單。

![主選單](https://raw.githubusercontent.com/devicki/grokbot-relay/main/docs/tui-main.png)

- 以 [gum](https://github.com/charmbracelet/gum) 打造。`install` 會下載官方 gum 版本（x64/arm64），驗證 `checksums.txt`，並放在 `/opt/grokbot-relay/bin/gum`，與 Node 執行環境一樣不在全域 PATH 中。若失敗，選單會退回使用 whiptail 或純文字提示。
- 深色霓虹風格：紫羅蘭／青色強調、圓角邊框，以及狀態列（`● online · port · bots · version`）。耗時步驟會顯示旋轉指示器。精靈步驟顯示 `[n/8]` 與進度條。
- 首次執行（尚未安裝）會提供**設定精靈**：歡迎 → Node 執行環境 → 安裝 → Cursor 登入（印出登入連結）→ 選擇機器人（多選，目前名稱已預先勾選，另可手動輸入；清單不可為空）→ 啟動 → doctor → 群組使用者。`sudo grokbot-relay install --tui` 可直接開啟。
- 精靈按鍵：**Esc** = 返回上一步（第 1 步會詢問是否離開）· **Ctrl+C** = 確認後離開，絕不會前進。純文字模式：`b` 返回、`q` 離開。重新執行 `sudo grokbot-relay install --tui` 即可接續。
- 移除或取消勾選機器人，只會把它從**此中繼的允許清單**中拿掉。你在 Grok Bot App 中的機器人永遠不會被刪除，帳號中的其他任何東西也不會（包括解除安裝）。
- 無頭伺服器／SSH：`login` 會印出登入 URL 並等待。在任何電腦的瀏覽器中開啟它，指令就會自行結束。「Opening your browser」這行可以忽略。若到處都沒有瀏覽器：使用 Cursor 儀表板取得的金鑰執行 `bdk login --api-key <key>`。
- 群組使用者（精靈第 8 步、選單「Group users」或 `sudo grokbot-relay users pick`）：多選一般帳號，現有成員已預先勾選，並可用逗號或空白分隔加入更多名稱。取消勾選成員會在確認後將其移除。非互動式：`users list | add NAME... | remove NAME...`。使用者之後必須登出再登入。結尾的指南會列出管理員做了什麼，以及每位使用者要執行的指令。
- 主選單：Status · Start/stop/restart/logs · Bots · Cursor login · Doctor · Update · Cursor BDK/Node runtime · Setup wizard · Connect Claude Code · About · Uninstall（輸入 `YES`）。
- `grokbot-relay --plain` 或 `NO_COLOR=1` 會提供無色彩的純文字提示。所有子指令仍可非互動式使用。
- 新增選單項目只需在 `bin/lib/tui.sh` 加一行（在 `MAIN_MENU`、`WIZARD_STEPS`… 中加入 `"id|label|function"`）。

## CLI

`install` 會把 `/usr/local/bin/grokbot-relay` 連結到 `/opt/grokbot-relay/bin` 中的副本。來源 clone 的路徑會記錄在 `/etc/grokbot-relay/source` 供 `update` 使用。權杖永遠不會被印出。

| 指令 | Root | 內容 |
|---|---|---|
| `install [--port N] [--node private\|system] [--tui]` | 是 | 使用者、`/opt` 程式、`npm ci`、env（權杖只產生一次）、`agents.json`（若缺少則由範例建立）、啟用 systemd unit 但不啟動 |
| `login` | 是 | 以 grokbot 使用者執行 `bdk login` |
| `start`、`stop`、`restart` | 是 | 控制服務 |
| `status`、`logs [-f]` | 否 | `systemctl status`、`journalctl` |
| `enable`、`disable` | 是 | 是否開機啟動 |
| `update [-v]` | 是 | 在來源 clone 中 `git pull --ff-only`、重新複製、`npm ci`、重新啟動；保留 env 與 `agents.json`；精簡的步驟訊息與簡短的「What's new」；`-v` 顯示完整輸出 |
| `node-upgrade` | 是 | 將私有 Node 執行環境更新到最新 24.x |
| `bdk-check` | 否 | 比較已安裝與 npm 最新的 `@cursor/bdk`，附連結。高於 `0.2.28` 的新版本會顯示，但不會當成 v0 的升級來建議 |
| `bdk-upgrade [--pin] [--dev] [-v] [--dry-run]` | 是（`--dry-run` 不需 root） | 只有解析出的版本不高於 `0.2.28` 時才安裝到 `/opt`，再 `bdk validate`，通過才重新啟動，否則回滾。高於 `0.2.28` 的目標在下載前拒絕。`--dry-run` 只檢查這個上限，不安裝。`--pin` 會把 `relay/package*.json` 寫入來源 clone，方便你開 PR。`--dev`/`-v` 也會印出如何把升級分享到上游 |
| `agents list` | 群組 | 允許的名稱 |
| `agents pick` | 是 | 多選目前名稱（已預先勾選）並可手動輸入名稱。Grok Bot 帳號的機器人清單**無法取得**：@cursor/bdk 沒有清單路由，因此尚未加入的名稱必須手動輸入。在終端機執行不帶名稱的 `agents add` 會開啟相同的選擇畫面 |
| `agents add NAME`、`agents remove NAME`、`agents edit` | 是 | 修改 `agents.json` 並重新啟動；拒絕空清單 |
| `doctor` | 最好用 root | node、檔案與權限、服務、127.0.0.1 上的連接埠、登入（`bdk whoami`）、bdk 版本 |
| `connect-claude [--scope user\|local]` | 否（grokbot 群組） | 在 Claude Code 中註冊中繼 |
| （無參數）、`tui` | | 終端機選單 |
| `uninstall [--purge\|--keep-config] [-y]` | 是 | 移除中繼；見下方 |
| `version`、`help` | 否 | |

注意事項：
- `connect-claude` 儲存的是啟動時讀取 `/etc/grokbot-relay/env` 的 `bash -c` 指令，因此權杖**不會**寫入 Claude Code 的設定（`~/.claude.json`）。若改用 `claude mcp add` 直接帶入權杖，權杖會以明文儲存在那裡。
- 權杖仍以行程參數（`--bearer-token`）傳遞，因此其他本機使用者可能在 `ps` 中看到它。在共用伺服器上，請以 `hidepid=2` 掛載 `/proc`，或接受群組成員與管理員能看到它。
- `grokbot` 群組中的每個人共用同一個權杖，因此共用同一個 BDK 呼叫者身分（聯絡人清單與已讀位置）以及同一個 Grok Bot 帳號。
- 輪替權杖：編輯 env 檔案後執行 `sudo grokbot-relay restart`，使用者不需重做任何事（每次啟動時都會讀取）。

**需在伺服器上驗證**
- unit 中的 `bdk serve` 旗標：`--host 127.0.0.1 --port`、`--mode single`（MCP 位於 `/v1/mcp`）、`--bearer-token`（依 0.2.25 CLI 參考，尚未執行）。
- `doctor` 的登入檢查（`bdk whoami`）是否可用，以及 `bdk login` 憑證（儲存在 `/var/lib/grokbot` 下的 CLI 設定目錄）在重新開機後是否仍在，並能在強化過的 unit 下運作。
- `bdk login` 在無頭伺服器上是否可用（它會印出可在任何瀏覽器開啟的登入連結）。

### 解除安裝

```bash
sudo grokbot-relay uninstall                # 列出要移除的項目、詢問是否繼續，再詢問設定、登入、使用者
sudo grokbot-relay uninstall --keep-config  # 保留 /etc/grokbot-relay（權杖、agents.json）
sudo grokbot-relay uninstall --purge -y     # 全部移除，不詢問
```

一律移除服務 unit、`/opt/grokbot-relay`、`/usr/local/bin/grokbot-relay` 與 `/etc/grokbot-relay/source`。絕不動你的來源 clone。也可在 TUI 中操作（Uninstall，輸入 `YES` 確認）。

## v0 與 v1

上面的安裝是 **v0** 線（`relay/`、`@cursor/bdk@0.2.28`、`cursor-grokbot-agents`）。沒有改動。**v1** 是給 Agent SDK 0.3 的第二棵樹。`grokbot-relay install` 不會複製它，systemd unit 也不變。

| | v0 | v1 |
| --- | --- | --- |
| 目錄 | `relay/` | `relay-v1/` |
| 版本 | 根目錄 `VERSION`（`0.8.x`），標籤 `v0.8.x` | `relay-v1/VERSION`（提議 `1.0.0`，尚未標籤） |
| 套件 | `@cursor/bdk@0.2.28` | `@grok/agent-sdk@0.3.0`（`bdk` 執行檔是同一個檔案） |
| 連接 Grok Bot | `cursor-grokbot-agents` | 本儲存庫的 `/v0/grokbot` HTTP 客戶端 |
| 目前 | `sudo grokbot-relay install` | 只從這個樹的檢出做試用 |

v1 不 import `cursor-grokbot-agents`。工具是 `grokbot__list`、`grokbot__ask`、`grokbot__check`。沒有 `grokbot__interrupt`。`list` 回傳的是允許清單，加上這位呼叫者已經問過的聯絡對象。不是帳號裡全部機器人的清單。空的允許清單會丟出錯誤，絕不是「任何名稱都可以」。每個 `POST …/messages` 本文前面都會加上 `[relay:claude-code]`。

不要用 `bdk-upgrade` 走到 v1。v0 留在 `0.2.28`。`bdk-upgrade` 會在 `npm install` 之前拒絕高於 `0.2.28` 的 `@cursor/bdk`。兩條線都不追 npm `latest`。以後的安裝應檢出明確的標籤：`relay/` 用 `v0.8.x`，`relay-v1/` 在標籤存在之後用 `v1.0.0`。

### 以後的伺服器試用（v1）

在已經有 `grokbot` 使用者 Cursor 登入的伺服器上做。不要把 API 金鑰放在命令列。不要用 `/var/lib/grokbot/state`（那是正在跑的 v0 服務）。`ask` 若用新的機器人名稱，會建立一個空的機器人。請用 Grok Bot App 裡已經存在的名稱。把兩處的 `YOUR_EXISTING_BOT` 都換成那個名稱。

`npm test` 和 `validate` 不會呼叫 API。`whoami` 只讀本機登入。若那個帳號不是機器人帳號就停下來。`grokbot__ask` 會送出一則真正的訊息。

```bash
cd relay-v1
# Node 22+。這台伺服器上若 `node` 較舊，私人執行環境在 /opt/grokbot-relay/node/bin。
export PATH="/opt/grokbot-relay/node/bin:$PATH"
npm ci
npm test
./node_modules/.bin/agent-sdk validate --dir . --json

# grokbot 使用者是 nologin。-H 會選它的家目錄，Cursor 登入在那裡。
sudo -u grokbot -H ./node_modules/.bin/agent-sdk whoami --json

sudo -u grokbot -H env GROKBOT_RELAY_AGENTS='YOUR_EXISTING_BOT' \
  ./node_modules/.bin/agent-sdk tool call grokbot__ask --dir . \
  --state-root /tmp/grokbot-relay-v1-trial \
  --input '{"agent":"YOUR_EXISTING_BOT","message":"v1 trial ping","wait_seconds":60}' \
  --json
```

允許清單在該行程啟動時讀取。空清單會拒絕這次呼叫，不代表所有機器人。回覆若是 `status: "running"`，用 `grokbot__check` 繼續等。沒有 interrupt 指令。

## 發行版本

根目錄 `VERSION` 是 v0 線（`0.8.x`）。`relay-v1/VERSION` 是 v1 線（提議 `1.0.0`，這次變更不打標籤）。`./bin/release` 只發佈根目錄那個檔案。該檔案的發行版本是 git 標籤 `vX.Y.Z`，以及說明取自 `CHANGELOG.md` 該節的 GitHub Release。見 [RELEASING.md](RELEASING.md)。

## 安全

- 讓 `serve` 只在回送介面（loopback）上。若要對外開放，先在前面放一個具驗證功能的代理。
- `check` 會讀取機器人對話。任何能連到中繼的人都能讀取回覆。
- 所有呼叫者共用同一個 Grok Bot 帳號與機器人記憶。
- **Feedhand 只接受請求。** 貼文只有在你於 Feedhand 對話中核准後才會發布。中繼永遠不會核准。
- `bdk mcp` 不支援 `--prod` 託管部署。請在本機執行。
- **發送者標頭。** 中繼會在它送出的每則訊息開頭加上 `[relay:claude-code]`（以及一行簡短說明），讓機器人能分辨這不是你在 App 中親自輸入的。請教你的發文機器人把這類訊息當作請求，絕不當作你的核准；Feedhand 就是這樣做的。若 bdk 升級移動了 ask 工具，中繼會退回使用不帶標頭的原生工具，並由 `doctor` 發出警告。

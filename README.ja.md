# grokbot-relay

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [繁體中文](README.zh-TW.md)

Claude Code、Cursor、ターミナルから、**ローカル**の Cursor BDK リレー（`cursor-grokbot-agents` 拡張）を通して自分の Grok Bot エージェントに質問し、答えを受け取ります。

> ステータス 0.1.0：`@cursor/bdk` 0.2.25 のドキュメントに照らして確認した骨組みです。**ローカルで要確認** と書かれた項目はまだテストしていません。

> 使い方スキル（Claude Code プラグイン）は [devicki/dev-toolkit](https://github.com/devicki/dev-toolkit/tree/main/plugins/grokbot-relay) にあります。このリポジトリはリレーサーバーです。

## 仕組み

```
Claude Code / Cursor ──stdio──> bdk mcp ──HTTP (127.0.0.1)──> bdk serve (relay/) ──> 自分の Grok Bot エージェント
```

- 許可リスト：サーバーローカルのみで、git には入れません。`GROKBOT_RELAY_AGENTS`（カンマ区切りの名前）または `/etc/grokbot-relay/agents.json`（形式：[`agents.example.json`](agents.example.json)、別のパスは `GROKBOT_RELAY_AGENTS_FILE`）。有効な設定がなければリレーは起動を拒否します。空のリストだと任意の名前を許可してしまうためです。名前は Grok Bot アプリに表示されるとおり正確にコピーしてください。タイプミスすると空のボットが新しく作られることがあります。`grokbot__interrupt` は `tools/interrupt.ts` で削除しています。
- 認証はこのマシン上の自分の Cursor ログインを使います。このリポジトリには何も保存されません。

## インストール（ローカル）

ローカル（サービスでない）利用には PATH 上に Node.js 22+ が必要です。下のサーバーインストールは独自の Node を持ち込みます。

```bash
cd relay
npm install
npx bdk login                     # ブラウザで自分の Cursor アカウントにログイン
export GROKBOT_RELAY_AGENTS="Feedhand,Research Bot"   # 自分のボット名、アプリの表示どおり
npx bdk validate
npx bdk dev                       # 任意：playground で「誰と話せる？」を試す

export GROKBOT_RELAY_TOKEN="$(openssl rand -hex 32)"   # git に入れないこと
npx bdk serve --dir . --port 47800 --bearer-token "$GROKBOT_RELAY_TOKEN"
```

**ローカルで要確認**
- `bdk serve` が表示するポートとベース URL、MCP パスが `/v1/mcp` か `/<slug>/v1/mcp` か
- `serve` が `--bearer-token` を受け付けるか（CLI ヘルプには serve 用として記載）、127.0.0.1 だけで待ち受けるか

### Cursor

```bash
npx bdk mcp install --url http://127.0.0.1:47800 --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot --print   # プレビュー
npx bdk mcp install --url http://127.0.0.1:47800 --bearer-token "$GROKBOT_RELAY_TOKEN" --name grokbot
```

トークンが `~/.cursor/mcp.json` に書き込まれます。このファイルは認証情報として扱ってください。

### Claude Code

```bash
export GROKBOT_RELAY_PORT=47800
claude mcp add grokbot -- npx -y @cursor/bdk mcp --url "http://127.0.0.1:$GROKBOT_RELAY_PORT" --bearer-token "$GROKBOT_RELAY_TOKEN"
```

または `.mcp.json.example` をプロジェクトの `.mcp.json` にコピーします。`GROKBOT_RELAY_PORT` と `GROKBOT_RELAY_TOKEN` は環境変数から読みます。続いて `grokbot-relay` スキルのためにこのプラグインをインストールします：

```bash
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

## サーバー配備（Linux、systemd）

サーバー 1 台、サービスアカウント `grokbot` 1 つ、ユーザー複数。管理者（root）がインストールし、`grokbot` グループの一般ユーザーが接続します。

| パス | 内容 |
| --- | --- |
| `/opt/grokbot-relay/relay` | リレーアプリ（所有者 `grokbot`） |
| `/var/lib/grokbot` | `grokbot` のホーム：Cursor ログイン + serve の状態 |
| `/etc/grokbot-relay/agents.json` | ボット名の許可リスト（640 root:grokbot、git には入れない） |
| `/etc/grokbot-relay/env` | `GROKBOT_RELAY_PORT`、`GROKBOT_RELAY_TOKEN`（640 root:grokbot） |

- 既定ポート：**47800**（あまり使われず、ウェルノウンポートでもない）。`install` は `ss -ltn` で確認し、使用中なら次の空きポートを使います（ウィザードはあらかじめ入力）。すでに設定済みのポートは更新・再インストール時も維持されます。

管理者（root）：

```bash
git clone https://github.com/devicki/grokbot-relay && cd grokbot-relay
sudo ./bin/grokbot-relay install --tui    # ウィザード。非対話：install [--port N]
sudo grokbot-relay agents add "Feedhand"  # 自分のボット名、アプリの表示どおり（または agents edit）
sudo grokbot-relay agents remove "Research Bot"   # 例の名前を削除
sudo grokbot-relay login                  # grokbot ユーザーとして Cursor にサインイン
sudo grokbot-relay start
sudo grokbot-relay doctor
sudo usermod -aG grokbot <user1>
sudo usermod -aG grokbot <user2>
```

あとで更新：

```bash
sudo grokbot-relay update                 # 記録された clone で git pull、再コピー、npm ci、再起動。旧 -> 新バージョンを表示
sudo grokbot-relay bdk-check              # 新しい @cursor/bdk が出ているか
sudo grokbot-relay bdk-upgrade            # 更新して validate、通れば再起動、失敗ならロールバック
```

> `bdk update` を直接実行しないでください。`grokbot-relay bdk-upgrade` を使います（リレーは `/opt` 配下の独自の bdk を使います）。

> このリリースは `@cursor/bdk` をちょうど `0.2.28` に固定します。`0.2.29` 以降は `cursor-grokbot-agents` 拡張を外すので、`0.2.28` より先へ上げないでください。

各一般ユーザー（`usermod` のあと一度ログアウトして再ログイン）：

```bash
id                                        # grokbot グループが表示されるか
grokbot-relay connect-claude              # MCP サーバー "grokbot" を登録（user スコープ）
claude mcp list
claude plugin marketplace add devicki/dev-toolkit
claude plugin install grokbot-relay@dev-toolkit
```

### Node ランタイム

リレーは **独自の Node 24** を `/opt/grokbot-relay/node` に持ちます。`install` が nodejs.org から公式 linux tarball（x64/arm64）をダウンロードし、`SHASUMS256.txt` で検証して展開します。**グローバル PATH には決して追加しない** ため、他のアカウントの Node（nvm など）には影響しません。CLI と systemd ユニット（`Environment=PATH=/opt/grokbot-relay/node/bin:/usr/bin:/bin`）だけが使います。インストーラーに必要なのは `curl`、`tar`、`sha256sum` だけです。

- `sudo grokbot-relay node-upgrade` は最新の 24.x に更新します（`bdk validate` が失敗したらロールバック）。`update` はランタイムを維持します。
- `install --node system` は既存のシステム node 22+ を使います。
- `connect-claude` は `/opt/grokbot-relay/node/bin/node` と `/opt/grokbot-relay/relay` にインストールされた `bdk` を登録するので、一般ユーザーはリレー用の Node を自分で用意する必要がありません（`grokbot` グループに読み取り・実行権限）。

## TUI

ターミナルで `sudo grokbot-relay`（引数なし）を実行するとメニューが開きます。

![メインメニュー](https://raw.githubusercontent.com/devicki/grokbot-relay/main/docs/tui-main.png)

- [gum](https://github.com/charmbracelet/gum) で作られています。`install` が gum の公式リリース（x64/arm64）をダウンロードし、`checksums.txt` を検証して `/opt/grokbot-relay/bin/gum` に置きます。Node ランタイムと同様にグローバル PATH には入れません。失敗した場合、メニューは whiptail かプレーンなプロンプトにフォールバックします。
- ダークネオン調：バイオレット／シアンのアクセント、角丸の枠、ステータスヘッダー（`● online · port · bots · version`）。時間のかかる処理はスピナーを表示し、ウィザードの各ステップは `[n/8]` と進捗バーを表示します。
- 初回（未インストール）は **セットアップウィザード** を提案します：ようこそ → Node ランタイム → インストール → Cursor ログイン（サインインリンクを表示）→ ボット選択（現在の名前がチェック済みの複数選択 + 手入力、空リスト不可）→ 起動 → doctor → グループユーザー。`sudo grokbot-relay install --tui` で直接開けます。
- ウィザードのキー：**Esc** = 1 ステップ戻る（ステップ 1 では終了を確認）· **Ctrl+C** = 確認後に終了（先へ進むことはない）。プレーンモード：`b` 戻る、`q` 終了。再開するには `sudo grokbot-relay install --tui` を再実行します。
- ボットを削除またはチェックを外しても、**このリレーの許可リスト** から外れるだけです。Grok Bot アプリのボットは削除されず、アカウント内の他のものも一切削除されません（アンインストールも同様）。
- ヘッドレスサーバー／SSH：`login` はサインイン URL を表示して待機します。任意のコンピューターのブラウザで開けば、コマンドは自動で完了します。「Opening your browser」の行は無害です。どこにもブラウザがない場合は、Cursor ダッシュボードで発行したキーで `bdk login --api-key <key>` を使います。
- グループユーザー（ウィザードのステップ 8、メニュー「Group users」、または `sudo grokbot-relay users pick`）：一般アカウントを複数選択でき（メンバーはチェック済み）、カンマまたはスペース区切りで名前を追加できます。メンバーのチェックを外すと、確認後に削除されます。非対話：`users list | add NAME... | remove NAME...`。ユーザーはその後ログアウトして再ログインする必要があります。最後のガイドに、管理者が行ったことと各ユーザーが実行するコマンドが表示されます。
- メインメニュー：Status · Start/stop/restart/logs · Bots · Cursor login · Doctor · Update · Cursor BDK/Node runtime · Setup wizard · Connect Claude Code · About · Uninstall（`YES` と入力）。
- `grokbot-relay --plain` または `NO_COLOR=1` で色なしのプレーンなプロンプトになります。すべてのサブコマンドは非対話でも動作します。
- メニュー項目の追加は `bin/lib/tui.sh` に 1 行（`MAIN_MENU`、`WIZARD_STEPS` などに `"id|label|function"`）です。

## CLI

`install` は `/usr/local/bin/grokbot-relay` を `/opt/grokbot-relay/bin` 内のコピーにリンクします。ソース clone のパスは `update` 用に `/etc/grokbot-relay/source` に記録されます。トークンは決して表示されません。

| コマンド | root | 内容 |
|---|---|---|
| `install [--port N] [--node private\|system] [--tui]` | 要 | ユーザー、`/opt` アプリ、`npm ci`、env（トークンは一度だけ生成）、`agents.json`（なければ例から作成）、systemd ユニットを有効化（起動はしない） |
| `login` | 要 | grokbot ユーザーとして `bdk login` |
| `start`、`stop`、`restart` | 要 | サービスの制御 |
| `status`、`logs [-f]` | 不要 | `systemctl status`、`journalctl` |
| `enable`、`disable` | 要 | 起動時に開始するかどうか |
| `update [-v]` | 要 | ソース clone で `git pull --ff-only`、再コピー、`npm ci`、再起動。env と `agents.json` は維持。簡潔なステップ表示と短い「What's new」。`-v` で全出力 |
| `node-upgrade` | 要 | 独自 Node ランタイムを最新の 24.x に更新 |
| `bdk-check` | 不要 | インストール済みと npm 最新の `@cursor/bdk` を比較、リンク付き |
| `bdk-upgrade [--pin] [--dev] [-v]` | 要 | `/opt` で `npm install @cursor/bdk@latest`、`bdk validate`、通った場合のみ再起動、失敗ならロールバック。`--pin` はソース clone の `relay/package*.json` を書き換え PR を出せるようにする。`--dev`/`-v` はアップストリームへの共有方法も表示 |
| `agents list` | グループ | 許可された名前 |
| `agents pick` | 要 | 現在の名前（チェック済み）の複数選択 + 手入力。Grok Bot アカウントのボット一覧は **取得できません**：@cursor/bdk に一覧取得のルートがないため、まだ追加していない名前は入力する必要があります。ターミナルで名前なしの `agents add` を実行すると同じ選択画面が開きます |
| `agents add NAME`、`agents remove NAME`、`agents edit` | 要 | `agents.json` を変更して再起動。空リストは拒否 |
| `doctor` | root 推奨 | node、ファイルと権限、サービス、127.0.0.1 のポート、ログイン（`bdk whoami`）、bdk バージョン |
| `connect-claude [--scope user\|local]` | 不要（grokbot グループ） | Claude Code にリレーを登録 |
| （引数なし）、`tui` | | ターミナルでメニュー |
| `uninstall [--purge\|--keep-config] [-y]` | 要 | リレーを削除。下記参照 |
| `version`、`help` | 不要 | |

注記：
- `connect-claude` は起動時に `/etc/grokbot-relay/env` を読む `bash -c` コマンドを登録するので、トークンは Claude Code の設定（`~/.claude.json`）に **書き込まれません**。代わりにトークンを直接入れて `claude mcp add` すると、そこに平文で保存されます。
- トークンはプロセス引数（`--bearer-token`）として渡されるため、他のローカルユーザーが `ps` で見られる可能性があります。共有サーバーでは `/proc` を `hidepid=2` でマウントするか、グループメンバーと管理者に見えることを受け入れてください。
- `grokbot` グループの全員が 1 つのトークンを共有するので、BDK の呼び出し元 ID（連絡先リストと既読位置）と同じ Grok Bot アカウントを共有します。
- トークンのローテーション：env ファイルを編集して `sudo grokbot-relay restart`。ユーザー側の再操作は不要です（起動のたびに読み込まれます）。

**サーバーで要確認**
- ユニット内の `bdk serve` フラグ：`--host 127.0.0.1 --port`、`--mode single`（MCP は `/v1/mcp`）、`--bearer-token`（0.2.25 CLI リファレンスに基づく、未実行）。
- `doctor` のログイン確認（`bdk whoami`）が動作するか、`bdk login` の認証情報（`/var/lib/grokbot` 配下の CLI 設定ディレクトリに保存）が再起動後も残り、ハードニングされたユニットで機能するか。
- ヘッドレスサーバーで `bdk login` が動作するか（任意のブラウザで開くサインインリンクを表示する）。

### アンインストール

```bash
sudo grokbot-relay uninstall                # 削除対象を一覧し、続行を確認、その後 設定・ログイン・ユーザーについて確認
sudo grokbot-relay uninstall --keep-config  # /etc/grokbot-relay（トークン、agents.json）を残す
sudo grokbot-relay uninstall --purge -y     # すべて削除、確認なし
```

サービスユニット、`/opt/grokbot-relay`、`/usr/local/bin/grokbot-relay`、`/etc/grokbot-relay/source` は常に削除します。ソース clone には触れません。TUI からも可能です（Uninstall、確認に `YES` と入力）。

## リリース

`VERSION` がリレーのバージョンです。リリースは同じ番号の git タグ `vX.Y.Z` と、ノートが `CHANGELOG.md` のその節である GitHub Release です。[RELEASING.md](RELEASING.md) を見てください。

## 安全性

- `serve` はループバックに留めてください。どこかに公開する前に、認証付きプロキシを前段に置いてください。
- `check` はボットの会話を読みます。リレーに到達できる人は誰でも返信を読めます。
- すべての呼び出し元が 1 つの Grok Bot アカウントとボットの記憶を共有します。
- **Feedhand はリクエスト専用です。** 投稿は Feedhand のチャットであなたが承認して初めて公開されます。リレーが承認することはありません。
- `bdk mcp` は `--prod` のホスト型デプロイでは動作しません。ローカルで実行してください。
- **送信者ヘッダー。** リレーは送信するすべてのメッセージの先頭に `[relay:claude-code]`（と短い 1 行）を付けるので、ボットはあなたがアプリで直接入力したものと区別できます。投稿系のボットには、こうしたメッセージを承認ではなくリクエストとして扱うよう教えてください。Feedhand はそうしています。bdk のアップグレードで ask ツールの位置が変わった場合、リレーはヘッダーなしの標準ツールにフォールバックし、`doctor` が警告します。
